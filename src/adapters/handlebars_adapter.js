/**
 * Handlebars Template Adapter
 *
 * v1 compatible template engine adapter
 */

import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { TemplateAdapter } from '../template_adapter.js';
import { resolveOutputPath } from '../template_helpers/engine/index.js';

export class HandlebarsAdapter extends TemplateAdapter {
  constructor(config = {}) {
    super(config);
    this.handlebars = Handlebars.create();
    this.searchPaths = config.searchPaths || [];
    this.partials = new Map();

    // Configure Handlebars (strict mode if specified)
    if (config.strict !== undefined && this.handlebars.options) {
      this.handlebars.options.strict = config.strict;
    }
  }

  /**
   * Render a template with context
   * @param {string} templatePath - Path to template file (relative or absolute)
   * @param {Object} context - Template context data
   * @returns {Promise<string>} - Rendered output
   */
  async render(templatePath, context) {
    // Resolve template path
    const resolvedPath = await this._resolveTemplatePath(templatePath);

    // Load and compile template
    const templateSource = await fs.readFile(resolvedPath, 'utf-8');
    const template = this.handlebars.compile(templateSource);

    // Render with context
    return template(context);
  }

  /**
   * Register a Handlebars helper
   * @param {string} name - Helper name
   * @param {Function} fn - Helper function
   */
  registerHelper(name, fn) {
    this.handlebars.registerHelper(name, fn);
  }

  /**
   * Register a partial template
   * @param {string} name - Partial name
   * @param {string} source - Partial template source
   */
  registerPartial(name, source) {
    this.handlebars.registerPartial(name, source);
    this.partials.set(name, source);
  }

  /**
   * Set template search paths
   * @param {Array<string>} paths - Directories to search
   */
  setSearchPaths(paths) {
    this.searchPaths = Array.isArray(paths) ? paths : [paths];
  }

  /**
   * Load all templates as partials from a directory (recursively)
   * Loads ALL files regardless of extension - templates can be any format
   * @param {string} templateDir - Directory containing templates
   */
  async loadPartials(templateDir) {
    try {
      await this._loadPartialsRecursive(templateDir, templateDir);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Directory doesn't exist, ignore
    }
  }

  /**
   * Recursively load all files as partials from directory
   * @private
   */
  async _loadPartialsRecursive(baseDir, currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this._loadPartialsRecursive(baseDir, fullPath);
      } else if (entry.isFile()) {
        // Load ALL files as templates/partials (format-agnostic)
        const source = await fs.readFile(fullPath, 'utf-8');
        
        // Use relative path from baseDir as partial name (normalized)
        const relativePath = path.relative(baseDir, fullPath);
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        // Register with full path including extension
        this.registerPartial(normalizedPath, source);
        
        // Also register without extension (v1 pattern: {{> partials/head}} finds partials/head.html)
        const ext = path.extname(normalizedPath);
        if (ext) {
          const nameWithoutExt = normalizedPath.slice(0, -ext.length);
          this.registerPartial(nameWithoutExt, source);
        }
      }
    }
  }

  /**
   * Resolve template path using search paths
   * @private
   */
  async _resolveTemplatePath(templatePath) {
    // If absolute path, use it
    if (path.isAbsolute(templatePath)) {
      return templatePath;
    }

    // Try each search path
    for (const searchPath of this.searchPaths) {
      const fullPath = path.join(searchPath, templatePath);
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        // Continue to next search path
      }
    }

    // If no search paths or not found, treat as relative to cwd
    return templatePath;
  }

  /**
   * Register engine-specific helpers (render_file, partial_exists)
   * These need direct access to Handlebars internals
   * 
   * @param {Object} buildContext - Build context (buildDir, outputs, log, etc.)
   */
  async registerEngineHelpers(buildContext) {
    const { resolveOutputPath } = await import('../template_helpers/engine/index.js');
    
    // Helper: partial_exists - Check if partial is registered
    this.registerHelper('partial_exists', (name) => {
      if (!name) return false;
      const partials = this.handlebars.partials || {};
      return Boolean(partials[String(name)]);
    });
    
    // Helper: render_file - Render partial to separate file
    // IMPORTANT: Use function() not arrow function to preserve 'this' as template context
    this.registerHelper('render_file', function(partialName, outputPath, options) {
      const { buildDir, outputs, log, templateKey } = buildContext;
      const handlebars = buildContext.adapter.handlebars;
      
      if (!outputs || !buildDir) {
        log?.warn?.('render_file helper called without buildDir/outputs');
        return '';
      }
      
      // Look up partial
      const partials = handlebars.partials || {};
      const partial = partials[partialName];
      
      if (!partial) {
        log?.warn?.(`render_file: partial '${partialName}' not found`);
        return '';
      }
      
      // Resolve output path with security checks
      const resolved = resolveOutputPath(templateKey || 'unknown', outputPath, buildDir, log);
      if (!resolved) {
        return '';
      }
      
      // Merge context with hash parameters
      // 'this' in a regular function is the Handlebars template context (the instance)
      const context = options.hash ? { ...this, ...options.hash } : this;
      
      // Create data frame
      const data = handlebars.createFrame(options.data || {});
      Object.assign(data, options.hash || {});
      
      // Compile and render partial
      const compiledPartial = typeof partial === 'function' 
        ? partial 
        : handlebars.compile(partial);
      
      const content = compiledPartial(context, { data }) || '';
      
      // Queue for writing (atomic rendering)
      outputs.push({ 
        path: resolved, 
        content, 
        template: partialName, 
        instance: context.id 
      });
      
      return '';  // Don't output in main template
    });
    
    // Helper: file - Write inline content to file
    this.registerHelper('file', (filename, options) => {
      const { buildDir, outputs, log, templateKey } = buildContext;
      
      if (!outputs || !buildDir) {
        log?.warn?.('file helper called without buildDir/outputs');
        return '';
      }
      
      const resolved = resolveOutputPath(templateKey || 'unknown', filename, buildDir, log);
      if (!resolved) {
        return '';
      }
      
      // Get content from block or inline
      const content = options.fn ? options.fn(this) : '';
      
      outputs.push({ path: resolved, content: String(content) });
      
      return '';
    });
  }

  /**
   * Get engine name
   * @returns {string}
   */
  getEngineName() {
    return 'handlebars';
  }
}
