/**
 * Core type definitions for Struktur 2.0
 *
 * Key principle: Keep schemas separate, no pre-merging
 */

/**
 * @typedef {Object} ClassDefinition
 * Raw class definition loaded from filesystem
 * @property {string} class - Class name
 * @property {string|Array<string>} [parent] - Parent class name (or array for multi-parent)
 * @property {Object} schema - JSON Schema (NOT merged with parents)
 * @property {Object.<string, any>} [fields] - Default field values
 * @property {Array<string>|Object.<string, AspectRequirement>} [aspects] - Aspect requirements (array or object)
 */

/**
 * @typedef {Object} AspectRequirement
 * @property {boolean} required - Whether aspect is required
 */

/**
 * @typedef {Object} AspectDefinition
 * Aspect definition loaded from filesystem
 * @property {string} aspect - Aspect name
 * @property {string} [kind] - Aspect category
 * @property {string} [description] - Human-readable description
 * @property {Object} schema - JSON Schema for aspect data
 * @property {Object.<string, any>} [defaults] - Default values
 */

/**
 * @typedef {Object} ResolvedClass
 * Class with computed lineage, ready for validation
 * @property {string} class - Class name
 * @property {Array<string>} lineage - Full inheritance chain (root to leaf)
 * @property {Array<Object>} schemas - Schema chain (one per lineage entry)
 * @property {Object.<string, any>} fields - Merged default fields
 * @property {Array<string>} aspects - Merged aspect requirements
 */

/**
 * @typedef {Object} ValidationResult
 * Result of validating an instance
 * @property {boolean} valid - Whether instance is valid
 * @property {Array<ValidationError>} errors - Array of validation errors
 */

/**
 * @typedef {Object} ValidationError
 * Individual validation error
 * @property {string} level - Error level (error, warning)
 * @property {string} code - Error code
 * @property {string} layer - Layer where error occurred (class name or aspect:name)
 * @property {string} message - Human-readable error message
 * @property {string} [instance] - Instance ID
 * @property {string} [path] - JSON path to error location
 * @property {string} [aspect] - Aspect name (for aspect errors)
 * @property {Object} [ajvError] - Original Ajv error object
 */

/**
 * @typedef {Object} SourceDefinition
 * Configuration for loading from a source
 * @property {string} type - Source type (filesystem, http, etc.)
 * @property {string} path - Path/URL to source
 * @property {Object} [options] - Source-specific options
 */

export const Types = {
  // Type definitions exported for documentation
  // Actual validation happens via JSDoc comments above
};
