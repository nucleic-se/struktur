/**
 * Template Helper Registry
 * 
 * Manages registration and organization of template helpers for multiple engines.
 * Supports three categories:
 * - Generic helpers: Pure functions (eq, where, pluck, slugify)
 * - Struktur helpers: Need context (inherits, schema_required, class_lineage)
 * - Engine helpers: Need build context (render_file, partial_exists)
 */

export class HelperRegistry {
  constructor() {
    this.helpers = new Map();
    this.categories = {
      generic: [],
      struktur: [],
      engine: []
    };
  }

  /**
   * Register a helper function
   * @param {string} name - Helper name
   * @param {Function} fn - Helper function
   * @param {Object} [options] - Registration options
   * @param {string} [options.category='generic'] - Helper category
   * @param {boolean} [options.requiresContext=false] - Needs struktur context
   * @param {boolean} [options.requiresBuildContext=false] - Needs build context
   */
  register(name, fn, options = {}) {
    const {
      category = 'generic',
      requiresContext = false,
      requiresBuildContext = false,
      description = ''
    } = options;

    if (this.helpers.has(name)) {
      throw new Error(`Helper '${name}' is already registered`);
    }

    const helperDef = {
      name,
      fn,
      category,
      requiresContext,
      requiresBuildContext,
      description
    };

    this.helpers.set(name, helperDef);
    this.categories[category].push(name);

    return this;
  }

  /**
   * Register multiple helpers at once
   * @param {Object} helpers - Map of name => function
   * @param {Object} [options] - Options applied to all helpers
   */
  registerMany(helpers, options = {}) {
    for (const [name, fn] of Object.entries(helpers)) {
      this.register(name, fn, options);
    }
    return this;
  }

  /**
   * Get a helper by name
   * @param {string} name - Helper name
   * @returns {Object|undefined} - Helper definition
   */
  get(name) {
    return this.helpers.get(name);
  }

  /**
   * Check if helper exists
   * @param {string} name - Helper name
   * @returns {boolean}
   */
  has(name) {
    return this.helpers.has(name);
  }

  /**
   * Get all helpers in a category
   * @param {string} category - Category name
   * @returns {Array<Object>} - Array of helper definitions
   */
  getCategory(category) {
    const names = this.categories[category] || [];
    return names.map(name => this.helpers.get(name));
  }

  /**
   * Get all helper names
   * @returns {Array<string>}
   */
  getAllNames() {
    return Array.from(this.helpers.keys());
  }

  /**
   * Register all helpers to a template adapter
   * @param {Object} adapter - Template adapter (Handlebars, Nunjucks, etc.)
   * @param {Object} [context] - Struktur context (classes_by_id, canonical, etc.)
   * @param {Object} [buildContext] - Build context (buildDir, outputs, log)
   */
  registerToAdapter(adapter, context = {}, buildContext = {}) {
    for (const [name, helperDef] of this.helpers) {
      let helperFn = helperDef.fn;

      // Bind context if needed
      if (helperDef.requiresContext) {
        helperFn = helperFn.bind(null, context);
      }

      // Bind build context if needed
      if (helperDef.requiresBuildContext) {
        helperFn = helperFn.bind(null, buildContext);
      }

      // Register to adapter
      adapter.registerHelper(name, helperFn);
    }

    return this;
  }

  /**
   * Clear all registered helpers
   */
  clear() {
    this.helpers.clear();
    this.categories = {
      generic: [],
      struktur: [],
      engine: []
    };
  }

  /**
   * Get statistics about registered helpers
   * @returns {Object}
   */
  stats() {
    return {
      total: this.helpers.size,
      generic: this.categories.generic.length,
      struktur: this.categories.struktur.length,
      engine: this.categories.engine.length
    };
  }
}

/**
 * Create a global registry instance
 */
export const globalRegistry = new HelperRegistry();

/**
 * Convenience function to register a helper
 */
export function registerHelper(name, fn, options) {
  return globalRegistry.register(name, fn, options);
}

/**
 * Convenience function to get helper stats
 */
export function getHelperStats() {
  return globalRegistry.stats();
}
