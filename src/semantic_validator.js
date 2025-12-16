/**
 * SemanticValidator - Format and data quality validation
 * 
 * Checks:
 * - Format validation (email, uri, hostname, ipv4, port)
 * - Quality checks (empty fields, placeholder values)
 * 
 * All findings are warnings (level='warning'), not errors
 */

class SemanticValidator {
  constructor() {
    // Format validation patterns
    this.formatCheckers = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^https?:\/\/.+/,
      hostname: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/,
      ipv4: (val) => {
        if (typeof val !== 'string') return false;
        const parts = val.split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
          const num = parseInt(part, 10);
          return num >= 0 && num <= 255 && part === String(num);
        });
      },
      port: (val) => Number.isInteger(val) && val >= 1 && val <= 65535
    };

    // Placeholder patterns
    this.placeholders = ['TODO', 'FIXME', 'XXX', 'TBD'];

    // Display fields that should not be empty
    this.displayFields = ['name', 'description'];
  }

  /**
   * Check if value matches format
   * @param {*} value - Value to check
   * @param {string} format - Format name (email, uri, etc.)
   * @returns {boolean} True if valid
   */
  checkFormat(value, format) {
    const checker = this.formatCheckers[format];
    if (!checker) return true; // Unknown format, skip

    if (typeof checker === 'function') {
      return checker(value);
    }

    if (checker instanceof RegExp) {
      return checker.test(String(value));
    }

    return true;
  }

  /**
   * Perform quality checks on instance
   * @param {Object} instance - Instance to check
   * @returns {Array<Object>} Array of warnings
   */
  checkQuality(instance) {
    const warnings = [];

    // Check for empty display fields
    for (const field of this.displayFields) {
      if (instance[field] === '') {
        warnings.push({
          level: 'warning',
          code: 'empty_field',
          message: `Field '${field}' is empty`,
          path: `/${field}`,
          instance: instance.id
        });
      }
    }

    // Check for placeholder values in all string fields
    this._walkAllFields(instance, '', (path, value) => {
      if (typeof value === 'string') {
        for (const placeholder of this.placeholders) {
          if (value.includes(placeholder)) {
            warnings.push({
              level: 'warning',
              code: 'placeholder_value',
              message: `Field contains placeholder: ${value}`,
              path,
              instance: instance.id
            });
            break; // Only warn once per field
          }
        }
      }
    });

    return warnings;
  }

  /**
   * Validate instance (main entry point)
   * @param {Object} instance - Instance to validate
   * @returns {Array<Object>} Array of warnings
   */
  validateInstance(instance) {
    const warnings = [];

    // Quality checks
    warnings.push(...this.checkQuality(instance));

    // Format validation would go here if we had schema metadata
    // For now, quality checks are the main semantic validation

    return warnings;
  }

  /**
   * Walk all fields in object recursively
   * @private
   */
  _walkAllFields(obj, basePath, callback) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const path = basePath ? `${basePath}/${key}` : `/${key}`;

      // Call callback for this field
      callback(path, value);

      // Recurse into objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this._walkAllFields(value, path, callback);
      }

      // Recurse into arrays
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (item && typeof item === 'object') {
            this._walkAllFields(item, `${path}[${index}]`, callback);
          } else {
            callback(`${path}[${index}]`, item);
          }
        });
      }
    }
  }
}

export { SemanticValidator };
