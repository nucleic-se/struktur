/**
 * Template Engine Adapter Base Class
 *
 * Abstract interface for pluggable template engines
 */

export class TemplateAdapter {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Render a template with context data
   * @param {string} templatePath - Path to template file
   * @param {Object} context - Data to pass to template
   * @returns {Promise<string>} - Rendered output
   */
  async render(_templatePath, _context) {
    throw new Error('TemplateAdapter.render() must be implemented by subclass');
  }

  /**
   * Register a custom helper/filter
   * @param {string} name - Helper name
   * @param {Function} fn - Helper function
   */
  registerHelper(_name, _fn) {
    throw new Error('TemplateAdapter.registerHelper() must be implemented by subclass');
  }

  /**
   * Set template search paths
   * @param {Array<string>} paths - Directories to search for templates
   */
  setSearchPaths(_paths) {
    throw new Error('TemplateAdapter.setSearchPaths() must be implemented by subclass');
  }

  /**
   * Get engine name
   * @returns {string}
   */
  getEngineName() {
    return this.constructor.name;
  }
}
