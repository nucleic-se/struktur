import nunjucks from 'nunjucks';
import path from 'path';
import { promises as fs } from 'fs';
import { TemplateAdapter } from '../template_adapter.js';

/**
 * Nunjucks template engine adapter
 * Provides Jinja2/Django-style templating with powerful inheritance and filters
 */
export default class NunjucksAdapter extends TemplateAdapter {
  constructor(config = {}) {
    super(config);

    // Create Nunjucks environment with sane defaults
    this.env = new nunjucks.Environment(null, {
      autoescape: config.autoescape !== false,
      trimBlocks: config.trimBlocks !== false,
      lstripBlocks: config.lstripBlocks !== false,
      throwOnUndefined: config.throwOnUndefined || false,
      noCache: config.noCache || false
    });

    this.searchPaths = [];
  }

  /**
   * Get the engine name
   * @returns {string}
   */
  getEngineName() {
    return 'nunjucks';
  }

  /**
   * Set template search paths
   * @param {string[]} paths - Array of directory paths to search
   */
  setSearchPaths(paths) {
    this.searchPaths = Array.isArray(paths) ? paths : [paths];

    // Recreate environment with new loader
    // This ensures the loader is properly initialized with the search paths
    const loader = new nunjucks.FileSystemLoader(this.searchPaths, {
      noCache: true,  // Always reload for testing
      watch: false
    });

    this.env = new nunjucks.Environment(loader, {
      autoescape: this.config.autoescape !== false,
      trimBlocks: this.config.trimBlocks !== false,
      lstripBlocks: this.config.lstripBlocks !== false,
      throwOnUndefined: this.config.throwOnUndefined || false,
      noCache: true  // Always reload for testing
    });
  }

  /**
   * Register a custom filter/helper
   * @param {string} name - Filter name
   * @param {Function} fn - Filter function
   */
  registerHelper(name, fn) {
    this.env.addFilter(name, fn);
  }

  /**
   * Register a custom global function
   * @param {string} name - Global name
   * @param {*} value - Global value or function
   */
  registerGlobal(name, value) {
    this.env.addGlobal(name, value);
  }

  /**
   * Resolve template path by searching configured paths
   * @private
   * @param {string} templateName - Template filename
   * @returns {Promise<string|null>}
   */
  async _resolveTemplatePath(templateName) {
    for (const searchPath of this.searchPaths) {
      const fullPath = path.join(searchPath, templateName);
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        // Try next path
      }
    }
    return null;
  }

  /**
   * Render a template with context data
   * @param {string} templateName - Template filename (e.g., 'page.njk')
   * @param {Object} context - Template context data
   * @returns {Promise<string>} Rendered output
   */
  async render(templateName, context) {
    if (this.searchPaths.length === 0) {
      throw new Error('No template search paths configured. Call setSearchPaths() first.');
    }

    // Render template - Nunjucks handles path resolution via its loader
    return new Promise((resolve, reject) => {
      this.env.render(templateName, context, (err, result) => {
        if (err) {
          // Try with .njk extension if original failed
          if (!templateName.endsWith('.njk')) {
            this.env.render(`${templateName}.njk`, context, (err2, result2) => {
              if (err2) {
                reject(new Error(`Template not found: ${templateName} (searched: ${this.searchPaths.join(', ')})`));
              } else {
                resolve(result2);
              }
            });
          } else {
            // Normalize error message to match expected format
            const errorMsg = err.message.includes('template not found')
              ? `Template not found: ${templateName} (searched: ${this.searchPaths.join(', ')})`
              : `Failed to render ${templateName}: ${err.message}`;
            reject(new Error(errorMsg));
          }
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Register engine-specific helpers (render_file, partial_exists)
   * These need direct access to Nunjucks internals
   * 
   * @param {Object} buildContext - Build context (buildDir, outputs, log, etc.)
   */
  async registerEngineHelpers(buildContext) {
    const { resolveOutputPath } = await import('../template_helpers/engine/index.js');
    
    // Helper: partial_exists - Check if template exists
    this.registerGlobal('partial_exists', (name) => {
      if (!name) return false;
      
      // Check if template can be resolved by loader
      try {
        const loader = this.env.loaders?.[0];
        if (!loader) return false;
        
        // Try to get the template source
        const src = loader.getSource(this.env, name);
        return Boolean(src);
      } catch {
        return false;
      }
    });
    
    // Helper: render_file - Render template to separate file
    this.registerGlobal('render_file', (partialName, outputPath, context = {}) => {
      const { buildDir, outputs, log, templateKey } = buildContext;
      
      if (!outputs || !buildDir) {
        log?.warn?.('render_file helper called without buildDir/outputs');
        return '';
      }
      
      // Resolve output path with security checks
      const resolved = resolveOutputPath(templateKey || 'unknown', outputPath, buildDir, log);
      if (!resolved) {
        return '';
      }
      
      // Merge current context with provided context
      const mergedContext = { ...this.ctx, ...context };
      
      try {
        // Render the template
        const content = this.env.render(partialName, mergedContext);
        
        // Queue for writing (atomic rendering)
        outputs.push({ 
          path: resolved, 
          content, 
          template: partialName, 
          instance: mergedContext.id 
        });
      } catch (err) {
        log?.warn?.(`render_file: failed to render '${partialName}': ${err.message}`);
      }
      
      return '';  // Don't output in main template
    });
    
    // Helper: file - Write inline content to file
    this.registerGlobal('file', (filename, content = '') => {
      const { buildDir, outputs, log, templateKey } = buildContext;
      
      if (!outputs || !buildDir) {
        log?.warn?.('file helper called without buildDir/outputs');
        return '';
      }
      
      const resolved = resolveOutputPath(templateKey || 'unknown', filename, buildDir, log);
      if (!resolved) {
        return '';
      }
      
      outputs.push({ path: resolved, content: String(content) });
      
      return '';
    });
  }

  /**
   * Load all templates from a directory (for preloading/validation)
   * @param {string} templateDir - Directory containing templates
   * @returns {Promise<string[]>} Array of template names
   */
  async loadTemplatesFromDirectory(templateDir) {
    try {
      const files = await fs.readdir(templateDir);
      const templates = files
        .filter(f => f.endsWith('.njk') || f.endsWith('.html'))
        .sort();
      return templates;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
