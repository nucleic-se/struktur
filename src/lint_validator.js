/**
 * LintValidator - Data quality and convention linting
 * 
 * Checks:
 * - Missing descriptions
 * - Malformed IDs (not kebab-case)
 * - Empty arrays in significant fields
 * - Suspicious values (port 0, empty strings)
 * 
 * All findings are warnings (level='warning'), not errors
 */

class LintValidator {
  constructor(options = {}) {
    this.checkDescription = options.checkDescription !== false;
    this.checkId = options.checkId !== false;
    this.checkArrays = options.checkArrays !== false;
    this.checkValues = options.checkValues !== false;
    
    // Array fields to check for emptiness
    this.arrayFields = options.arrayFields || ['tags', 'categories', 'labels'];
    
    // ID pattern: lowercase alphanumeric + hyphens, no consecutive hyphens
    this.idPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  }

  /**
   * Check for missing or empty description
   * @param {Object} instance
   * @returns {Array<Object>} Warnings
   */
  checkDescription(instance) {
    if (!this.checkDescription) return [];
    
    const warnings = [];
    const desc = instance.description;
    
    if (!desc || (typeof desc === 'string' && desc.trim() === '')) {
      warnings.push({
        level: 'warning',
        code: 'missing_description',
        message: `Instance '${instance.id}' has no description`,
        path: '/description',
        instance: instance.id
      });
    }
    
    return warnings;
  }

  /**
   * Check for malformed IDs (not kebab-case)
   * @param {Object} instance
   * @returns {Array<Object>} Warnings
   */
  checkIdFormat(instance) {
    if (!this.checkId) return [];
    
    const warnings = [];
    const id = instance.id;
    
    if (id && !this.idPattern.test(id)) {
      warnings.push({
        level: 'warning',
        code: 'malformed_id',
        message: `ID '${id}' not in kebab-case format (lowercase, hyphen-separated)`,
        path: '/id',
        instance: instance.id
      });
    }
    
    return warnings;
  }

  /**
   * Check for empty arrays in significant fields
   * @param {Object} instance
   * @returns {Array<Object>} Warnings
   */
  checkEmptyArrays(instance) {
    if (!this.checkArrays) return [];
    
    const warnings = [];
    
    for (const field of this.arrayFields) {
      if (Array.isArray(instance[field]) && instance[field].length === 0) {
        warnings.push({
          level: 'warning',
          code: 'empty_array',
          message: `Field '${field}' is empty array (consider removing)`,
          path: `/${field}`,
          instance: instance.id
        });
      }
    }
    
    return warnings;
  }

  /**
   * Check for suspicious values
   * @param {Object} instance
   * @returns {Array<Object>} Warnings
   */
  checkSuspiciousValues(instance) {
    if (!this.checkValues) return [];
    
    const warnings = [];
    
    // Port 0 (likely unset)
    if (instance.port === 0) {
      warnings.push({
        level: 'warning',
        code: 'suspicious_value',
        message: `Port is 0 (likely unset or invalid)`,
        path: '/port',
        instance: instance.id
      });
    }
    
    // Empty name
    if (instance.name === '') {
      warnings.push({
        level: 'warning',
        code: 'suspicious_value',
        message: `Field 'name' is empty string`,
        path: '/name',
        instance: instance.id
      });
    }
    
    return warnings;
  }

  /**
   * Validate instance (main entry point)
   * @param {Object} instance - Instance to lint
   * @returns {Array<Object>} Array of warnings
   */
  validateInstance(instance) {
    const warnings = [];
    
    warnings.push(...this.checkDescription(instance));
    warnings.push(...this.checkIdFormat(instance));
    warnings.push(...this.checkEmptyArrays(instance));
    warnings.push(...this.checkSuspiciousValues(instance));
    
    return warnings;
  }
}

export { LintValidator };
