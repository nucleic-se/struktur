import nunjucks from 'nunjucks';
import path from 'path';
import { promises as fs } from 'fs';
import { TemplateAdapter } from '../template_adapter.js';
import {
  TemplateNotFoundError,
  TemplateSyntaxError,
  TemplateRenderError
} from '../template_errors.js';

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
          // Check if it's a "not found" error vs render/syntax error
          const isNotFound = err.message.includes('template not found');
          
          if (isNotFound) {
            // Template not found - provide helpful error with search paths
            const searchedPaths = this.searchPaths.map(p => path.join(p, templateName));
            const suggestions = [];
            
            // Suggest adding .njk extension if missing
            if (!templateName.endsWith('.njk') && !templateName.endsWith('.html')) {
              suggestions.push(`Use explicit extension: ${templateName}.njk`);
            }
            
            reject(new TemplateNotFoundError(templateName, searchedPaths, suggestions));
          } else {
            // Syntax or render error - extract location if available
            const location = err.message.match(/\[Line (\d+), Column (\d+)\]/);
            
            if (location) {
              // Syntax error with line/column
              const line = parseInt(location[1], 10);
              const column = parseInt(location[2], 10);
              reject(new TemplateSyntaxError(templateName, line, column, err.message));
            } else {
              // Check if it's a syntax/parse error (even without line/column)
              const isSyntaxError = err.message.match(/expected|unexpected|parse error|syntax/i);
              if (isSyntaxError) {
                reject(new TemplateSyntaxError(templateName, null, null, err.message));
              } else {
                // Runtime render error (undefined variable, etc.)
                reject(new TemplateRenderError(templateName, err.message, err.stack));
              }
            }
          }
        } else {
          // Check if template extended a layout
          if (context.__context?.extendedLayout) {
            const layoutName = context.__context.extendedLayout;
            // Clear the extends so the layout doesn't try to extend itself
            delete context.__context.extendedLayout;
            // Render the layout with the current context (which has all buffers)
            this.env.render(layoutName, context, (layoutErr, layoutResult) => {
              if (layoutErr) {
                reject(new TemplateRenderError(layoutName, layoutErr.message, layoutErr.stack));
              } else {
                resolve(layoutResult);
              }
            });
          } else {
            resolve(result);
          }
        }
      });
    });
  }

  /**
   * Validate template syntax without rendering
   * @param {string} templateName - Template filename
   * @returns {Promise<{valid: boolean, error?: Error}>}
   */
  async validate(templateName) {
    if (this.searchPaths.length === 0) {
      return {
        valid: false,
        error: new Error('No template search paths configured')
      };
    }

    try {
      // Try to render with empty context (forces full parsing + syntax check)
      await new Promise((resolve, reject) => {
        this.env.render(templateName, {}, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      return { valid: true };
    } catch (err) {
      const isNotFound = err.message.includes('template not found');
      
      if (isNotFound) {
        const searchedPaths = this.searchPaths.map(p => path.join(p, templateName));
        const suggestions = [];
        
        if (!templateName.endsWith('.njk') && !templateName.endsWith('.html')) {
          suggestions.push(`Use explicit extension: ${templateName}.njk`);
        }
        
        return {
          valid: false,
          error: new TemplateNotFoundError(templateName, searchedPaths, suggestions)
        };
      }
      
      // Parse/syntax error - try to extract line/column if available
      const location = err.message.match(/\[Line (\d+), Column (\d+)\]/);
      if (location) {
        const line = parseInt(location[1], 10);
        const column = parseInt(location[2], 10);
        return {
          valid: false,
          error: new TemplateSyntaxError(templateName, line, column, err.message)
        };
      }
      
      // Syntax error without line/column info - still a syntax error
      // Common patterns: "expected variable end", "unexpected token", etc.
      const isSyntaxError = err.message.match(/expected|unexpected|parse error|syntax/i);
      if (isSyntaxError) {
        return {
          valid: false,
          error: new TemplateSyntaxError(templateName, null, null, err.message)
        };
      }
      
      return {
        valid: false,
        error: err
      };
    }
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
      
      // Calculate relative path prefix based on output depth
      // E.g., 'posts/article.html' → '../', 'tags/tutorial.html' → '../'
      const pathDepth = outputPath.split('/').length - 1;
      const autoPathPrefix = pathDepth > 0 ? '../'.repeat(pathDepth) : '';
      
      // Merge current context with provided context
      // IMPORTANT: Preserve __context for buffer system
      const mergedContext = { ...this.ctx, pathPrefix: autoPathPrefix, ...context };
      
      // Explicitly preserve __context reference
      if (this.ctx && typeof this.ctx === 'object' && this.ctx.__context) {
        mergedContext.__context = this.ctx.__context;
      }
      
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
