/**
 * Template Renderer
 * Handles template rendering with helper registration, context management, and buffers
 */

import fs from 'fs/promises';
import path from 'path';
import { resolveOutputPath } from './template_helpers/engine/index.js';
import { RenderContext } from './render_context.js';
import { registerBufferHelpers } from './template_helpers/buffers.js';
import { OutputCollisionTracker } from './utils/output_collision_tracker.js';
import {
  TemplateNotFoundError,
  TemplateError,
  CircularExtendsError
} from './template_errors.js';

export class TemplateRenderer {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.log = options.log || console;
    this.quiet = options.quiet || false;
    this.searchPaths = [];
  }
  
  /**
   * Set template search paths
   * @param {string[]} paths - Template directories
   */
  setSearchPaths(paths) {
    this.searchPaths = paths;
  }

  /**
   * Register all helpers (generic, struktur-specific, and buffers)
   */
  async registerHelpers(canonical) {
    // Register all generic helpers
    const { genericHelpers } = await import('./template_helpers/generic/index.js');
    for (const [name, fn] of Object.entries(genericHelpers)) {
      this.adapter.registerHelper(name, fn);
    }

    // Register struktur-specific helpers (require canonical context)
    const strukturSchema = await import('./template_helpers/struktur/schema.js');
    const strukturInheritance = await import('./template_helpers/struktur/inheritance.js');
    
    // Bind helpers with canonical context
    const strukturContext = { $classes_by_id: canonical.$classes_by_id };
    this.adapter.registerHelper('schema_required', (className, fieldName) =>
      strukturSchema.schemaRequired(strukturContext, className, fieldName));
    this.adapter.registerHelper('schema_has', (className, fieldName) =>
      strukturSchema.schemaHas(strukturContext, className, fieldName));
    this.adapter.registerHelper('schema_props', (className) =>
      strukturSchema.schemaProps(strukturContext, className));
    this.adapter.registerHelper('schema_prop_source', (className, fieldName) =>
      strukturSchema.schemaPropSource(strukturContext, className, fieldName));
    this.adapter.registerHelper('schema_required_by_source', (className) =>
      strukturSchema.schemaRequiredBySource(strukturContext, className));
    this.adapter.registerHelper('inherits', (className, targetClasses) => 
      strukturInheritance.inherits(strukturContext, className, targetClasses));
    this.adapter.registerHelper('filter_inherits', (entries, targetClasses) =>
      strukturInheritance.filterInherits(strukturContext, entries, targetClasses));
    this.adapter.registerHelper('class_lineage', (className) =>
      strukturInheritance.classLineage(strukturContext, className));
    
    // Register buffer helpers (for extends/yields support)
    registerBufferHelpers(this.adapter);
  }

  /**
   * Load partials from template directories
   */
  async loadPartials(templateDirs) {
    for (const dir of templateDirs) {
      if (this.adapter.loadPartials) {
        try {
          await this.adapter.loadPartials(dir);
        } catch {
          // Directory doesn't exist, skip silently
        }
      }
    }
  }

  /**
   * Register engine-specific helpers with build context
   */
  async registerEngineHelpers(buildDir, renderFileOutputs) {
    if (this.adapter.registerEngineHelpers) {
      await this.adapter.registerEngineHelpers({
        buildDir,
        outputs: renderFileOutputs,
        log: this.quiet ? undefined : console,
        templateKey: 'index.html',
        adapter: this.adapter
      });
    }
  }

  /**
   * Build template context from canonical with RenderContext
   */
  buildContext(canonical, globalInstance, renderContext) {
    // Handle both full canonical structure and simple context objects
    const instances = canonical.$instances || [];
    const instancesById = canonical.$instances_by_id || {};

    // Prepare context with canonical as single source of truth
    // Include __context for buffer helpers
    return {
      global: globalInstance,
      $instances: instances,
      $instances_by_id: instancesById,
      canonical,
      __context: renderContext,  // Buffer system access
      ...canonical
    };
  }

  /**
   * Render all templates with pre-flight validation and buffer support
   * 
   * @param {Array<Object>} renderTasks - Render tasks: [{template: 'page.njk', output: '/page.html'}]
   * @param {Object} canonical - Canonical data (instances)
   * @param {string} buildDir - Build output directory
   * @param {Object} metadata - Build metadata (optional)
   * @returns {Promise<{renderedCount: number, outputs: Array}>}
   */
  async renderAll(renderTasks, canonical, buildDir, metadata = {}) {
    if (!Array.isArray(renderTasks)) {
      throw new Error('renderTasks must be an array');
    }
    if (!buildDir || typeof buildDir !== 'string') {
      throw new Error('buildDir must be a non-empty string');
    }

    this.validateRenderTasks(renderTasks);
    
    // Create render context (holds canonical data + buffers)
    const renderContext = new RenderContext(canonical, buildDir, metadata);
    
    // Pre-flight validation (find ALL issues before rendering)
    await this.validateAllTasks(renderTasks);
    
    // Register engine helpers with render context outputs
    const renderFileOutputs = [];
    await this.registerEngineHelpers(buildDir, renderFileOutputs);
    
    // Find global instance (handle both full canonical and simple context)
    const instances = canonical.$instances || [];
    const globalInstance = instances.find?.(obj => obj.id === 'global') || null;
    
    // Build template context with render context for buffers
    const templateContext = this.buildContext(canonical, globalInstance, renderContext);
    
    // Separate tasks by type (for extends/yields support)
    const { contentTasks, layoutTasks } = this.categorizeTasks(renderTasks);
    
    const collisionTracker = new OutputCollisionTracker();

    // Phase 1: Render content templates (write to buffers)
    for (const task of contentTasks) {
      await this.renderContent(task, templateContext, buildDir, renderContext, collisionTracker);
    }
    
    // Phase 2: Render layout templates (consume buffers via yields)
    for (const task of layoutTasks) {
      await this.renderLayout(task, templateContext, buildDir, renderContext, collisionTracker);
    }
    
    // Phase 3: Write render_file outputs (additional files from helpers)
    for (const output of renderFileOutputs) {
      const relativePath = path.relative(buildDir, output.path);
      const safeOutputPath = resolveOutputPath('render_file', relativePath, buildDir, console);
      collisionTracker.register(safeOutputPath, {
        template: output.template,
        instance: output.instance,
        source: 'render_file'
      });
      await fs.mkdir(path.dirname(safeOutputPath), { recursive: true });
      await fs.writeFile(safeOutputPath, output.content, 'utf-8');
    }
    
    // Get all outputs (from files + buffers)
    const outputs = renderContext.getFileOutputs();
    
    // Add buffer outputs with destinations
    for (const [name, buffer] of renderContext.buffers) {
      if (buffer.isFileOutput()) {
        outputs.push({
          destination: buffer.destination,
          content: buffer.read()
        });
      }
    }
    
    return {
      renderedCount: outputs.length,
      outputs
    };
  }
  
  /**
   * Pre-flight validation - find ALL errors before rendering
   */
  async validateAllTasks(renderTasks) {
    const issues = [];
    
    for (const task of renderTasks) {
      // Validate template exists
      try {
        await this.resolveTemplate(task.template);
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          issues.push({ task, error });
          continue;  // Can't validate further if file missing
        }
      }
      
      // Validate layout exists (if using extends)
      if (task.extends) {
        try {
          await this.resolveTemplate(task.extends);
        } catch (error) {
          if (error instanceof TemplateNotFoundError) {
            issues.push({ task, error });
          }
        }
      }
    }
    
    // Detect circular extends
    const chains = this.buildExtendsChains(renderTasks);
    for (const [template, chain] of Object.entries(chains)) {
      if (this.hasCircular(chain)) {
        issues.push({
          task: renderTasks.find(t => t.template === template),
          error: new CircularExtendsError(chain)
        });
      }
    }
    
    // If any issues found, show all and abort
    if (issues.length > 0) {
      this.log.log('\n⚠️  Pre-flight validation found issues:\n');
      for (const issue of issues) {
        const error = issue.error;
        if (error && typeof error.format === 'function') {
          this.log.log(error.format());
        } else if (error instanceof Error) {
          this.log.log(`❌ ${error.message}`);
        } else {
          this.log.log(`❌ ${String(error)}`);
        }
        this.log.log('');
      }
      throw new Error(`${issues.length} validation issue(s). Fix above errors and retry.`);
    }
  }

  validateRenderTasks(renderTasks) {
    for (let i = 0; i < renderTasks.length; i++) {
      const task = renderTasks[i];
      if (!task || typeof task !== 'object' || Array.isArray(task)) {
        throw new Error(
          'Render tasks must use format: {"template": "...", "output": "..."}'
        );
      }
      if (!task.template || !task.output) {
        throw new Error(
          'Render tasks must use format: {"template": "...", "output": "..."}'
        );
      }
      const extraKeys = Object.keys(task).filter(key => key !== 'template' && key !== 'output');
      if (extraKeys.length > 0) {
        throw new Error(
          'Render tasks must use format: {"template": "...", "output": "..."}'
        );
      }
    }
  }
  
  /**
   * Resolve template to absolute path
   * @throws {TemplateNotFoundError} With smart suggestions
   */
  async resolveTemplate(templateName) {
    for (const searchPath of this.searchPaths) {
      const fullPath = path.join(searchPath, templateName);
      
      try {
        await fs.access(fullPath, fs.constants.R_OK);
        return fullPath;  // Found!
      } catch {
        // Try next path
      }
    }
    
    // Not found - generate helpful suggestions
    const suggestions = await this.generateSuggestions(templateName);
    const searchedPaths = this.searchPaths.map(p => path.join(p, templateName));
    throw new TemplateNotFoundError(templateName, searchedPaths, suggestions);
  }
  
  /**
   * Generate smart suggestions for missing template
   */
  async generateSuggestions(templateName) {
    const suggestions = [];
    
    // Check for extension mismatch
    if (!templateName.endsWith('.njk') && !templateName.endsWith('.hbs') && !templateName.endsWith('.html')) {
      for (const searchPath of this.searchPaths) {
        const njkPath = path.join(searchPath, templateName + '.njk');
        const hbsPath = path.join(searchPath, templateName + '.hbs');
        
        try {
          await fs.access(njkPath);
          suggestions.push(`Did you mean "${templateName}.njk"? Add extension to build config`);
          break;
        } catch {
          // Try hbs
        }
        
        try {
          await fs.access(hbsPath);
          suggestions.push(`Did you mean "${templateName}.hbs"? Add extension to build config`);
          break;
        } catch {
          // Not found
        }
      }
    }
    
    // Generic advice if no specific suggestion
    if (suggestions.length === 0) {
      suggestions.push('Ensure extension is correct (.njk for Nunjucks, .hbs for Handlebars)');
      suggestions.push('Verify build config render array matches actual files');
      suggestions.push('Check template directory path in build config');
    }
    
    return suggestions;
  }
  
  /**
   * Categorize tasks into content and layouts
   */
  categorizeTasks(renderTasks) {
    const contentTasks = [];
    const layoutTasks = [];
    
    for (const task of renderTasks) {
      if (task.extends) {
        layoutTasks.push(task);
      } else {
        contentTasks.push(task);
      }
    }
    
    return { contentTasks, layoutTasks };
  }
  
  /**
   * Render content template (writes to buffers for layout consumption)
   */
  async renderContent(task, templateContext, buildDir, renderContext, collisionTracker) {
    try {
      // Render template with canonical data + render context
      const output = await this.adapter.render(task.template, templateContext);
      
      // Write output to file
      if (task.output) {
        const resolvedPath = resolveOutputPath(task.template, task.output, buildDir, this.log);
        collisionTracker.register(resolvedPath, {
          template: task.template,
          source: 'render_task'
        });
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, output, 'utf-8');
        renderContext.addOutput(task.output, output);
      }
      
    } catch (error) {
      this.handleRenderError(error, task.template);
    }
  }
  
  /**
   * Render layout template (consumes buffers via yields)
   */
  async renderLayout(task, templateContext, buildDir, renderContext, collisionTracker) {
    try {
      // Future: First render content template (creates buffers)
      // Future: Then render layout (consumes buffers via yields)
      
      // For now: Just render the template directly
      const output = await this.adapter.render(task.template, templateContext);
      
      // Write output
      if (task.output) {
        const resolvedPath = resolveOutputPath(task.template, task.output, buildDir, this.log);
        collisionTracker.register(resolvedPath, {
          template: task.template,
          source: 'render_task'
        });
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, output, 'utf-8');
        renderContext.addOutput(task.output, output);
      }
      
    } catch (error) {
      this.handleRenderError(error, task.template);
    }
  }
  
  /**
   * Handle render errors with proper classification
   */
  handleRenderError(error, templateName) {
    // If already a TemplateError, just rethrow
    if (error instanceof TemplateError) {
      throw error;
    }
    
    // Otherwise wrap in generic error with context
    throw new Error(`Error rendering ${templateName}: ${error.message}`);
  }
  
  /**
   * Build extends chains for circular detection
   */
  buildExtendsChains(renderTasks) {
    const chains = {};
    
    for (const task of renderTasks) {
      if (!task.extends) continue;
      
      const chain = [task.template];
      let current = task.extends;
      
      // Follow extends chain
      while (current) {
        chain.push(current);
        
        // Find task that renders this template
        const nextTask = renderTasks.find(t => t.template === current);
        current = nextTask?.extends || null;
        
        // Safety: Prevent infinite loop
        if (chain.length > 100) break;
      }
      
      chains[task.template] = chain;
    }
    
    return chains;
  }
  
  /**
   * Check if chain has circular reference
   */
  hasCircular(chain) {
    const seen = new Set();
    for (const item of chain) {
      if (seen.has(item)) {
        return true;
      }
      seen.add(item);
    }
    return false;
  }
}
