/**
 * Template Renderer
 * Handles template rendering with helper registration and context management
 */

import fs from 'fs/promises';
import path from 'path';
import { resolveOutputPath } from './template_helpers/engine/index.js';

export class TemplateRenderer {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.log = options.log || console;
    this.quiet = options.quiet || false;
  }

  /**
   * Register all helpers (generic and struktur-specific)
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
    const strukturContext = { classes_by_id: canonical.classes_by_id };
    this.adapter.registerHelper('schemaRequired', (className, fieldName) => 
      strukturSchema.schemaRequired(strukturContext, className, fieldName));
    this.adapter.registerHelper('schemaHas', (className, fieldName) => 
      strukturSchema.schemaHas(strukturContext, className, fieldName));
    this.adapter.registerHelper('schemaProps', (className) => 
      strukturSchema.schemaProps(strukturContext, className));
    this.adapter.registerHelper('schemaPropSource', (className, fieldName) => 
      strukturSchema.schemaPropSource(strukturContext, className, fieldName));
    this.adapter.registerHelper('schemaRequiredBySource', (className) => 
      strukturSchema.schemaRequiredBySource(strukturContext, className));
    this.adapter.registerHelper('inherits', (className, targetClasses) => 
      strukturInheritance.inherits(strukturContext, className, targetClasses));
    this.adapter.registerHelper('filterInherits', (entries, targetClasses) => 
      strukturInheritance.filterInherits(strukturContext, entries, targetClasses));
    this.adapter.registerHelper('classLineage', (className) => 
      strukturInheritance.classLineage(strukturContext, className));
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
   * Build template context from canonical
   */
  buildContext(canonical, globalInstance) {
    // Build instances_by_id map for backward compatibility
    const instancesById = {};
    canonical.instances.forEach(obj => {
      instancesById[obj.id] = obj;
    });

    // Prepare context with canonical as single source of truth
    return {
      global: globalInstance,
      instances: canonical.instances,
      instances_by_id: instancesById,  // v1 compatibility
      canonical,
      ...canonical
    };
  }

  /**
   * Render all templates from build array
   * @returns {Promise<{renderedCount: number, outputs: Array}>}
   */
  async renderAll(buildArray, canonical, buildDir) {
    let renderedCount = 0;
    const renderFileOutputs = [];

    // Register engine helpers with render_file output collection
    await this.registerEngineHelpers(buildDir, renderFileOutputs);

    // Find global instance
    const globalInstance = canonical.instances.find(obj => obj.id === 'global');
    
    // Build template context
    const templateContext = this.buildContext(canonical, globalInstance);

    // Process each build task
    for (const task of buildArray) {
      for (const [templateFile, outputPath] of Object.entries(task)) {
        try {
          // Render template with full canonical context
          const content = await this.adapter.render(templateFile, templateContext);
          
          // Write main template output to specified path (with security check)
          const resolvedPath = resolveOutputPath(templateFile, outputPath, buildDir, console);
          if (!resolvedPath) {
            this.log.log(`  ✗ Skipping ${templateFile}: unsafe output path ${outputPath}`);
            continue;
          }
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, content, 'utf-8');
          renderedCount++;
        } catch (error) {
          this.log.log(`  ✗ Failed to process ${templateFile}: ${error.message}`);
        }
      }
    }

    // Write all render_file outputs (additional files generated by templates)
    if (renderFileOutputs.length > 0) {
      for (const output of renderFileOutputs) {
        try {
          // Security: validate output path is within buildDir
          const relativePath = path.relative(buildDir, output.path);
          const safeOutputPath = resolveOutputPath('render_file', relativePath, buildDir, console);
          if (!safeOutputPath) {
            this.log.log(`  ✗ Skipping render_file output: unsafe path ${relativePath}`);
            continue;
          }
          await fs.mkdir(path.dirname(safeOutputPath), { recursive: true});
          await fs.writeFile(safeOutputPath, output.content, 'utf-8');
          renderedCount++;
        } catch (error) {
          this.log.log(`  ✗ Failed to write render_file output: ${error.message}`);
        }
      }
    }

    return { renderedCount, outputs: renderFileOutputs };
  }
}
