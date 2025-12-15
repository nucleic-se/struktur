/**
 * Canonical Output Generator
 *
 * Generates canonical.json output with merged instances and metadata
 */

import { deepMerge } from './utils/deep_merge.js';
import { createLogger } from './utils/logger.js';

/**
 * Merge instance with class field defaults
 * @param {Object} instance - Instance data
 * @param {Object} fields - Class default fields
 * @returns {Object} - Merged instance
 */
function mergeInstanceWithFields(instance, fields = {}) {
  // Deep merge: start with empty object, merge defaults, then instance (instance wins)
  const merged = deepMerge(deepMerge({}, fields), instance);

  // Preserve aspects if present
  if (instance.aspects) {
    merged.aspects = instance.aspects;
    
    // Auto-populate kinds from aspect keys if not already set
    if (!merged.kinds && typeof instance.aspects === 'object') {
      merged.kinds = Object.keys(instance.aspects);
    }
  }

  return merged;
}

/**
 * Build class index with resolved class objects
 * @param {Array<Object>} objects - Merged objects
 * @param {ClassResolver} resolver - Class resolver for metadata
 * @param {Object} logger - Logger instance
 * @returns {Object} - Map of class name to resolved class object (not instance IDs)
 */
function buildClassIndex(objects, resolver, logger) {
  const index = {};
  const uniqueClasses = new Set();

  // Collect unique class names from objects
  for (const obj of objects) {
    if (obj.class) {
      uniqueClasses.add(obj.class);
    }
  }

  // Resolve each class and add to index
  for (const className of uniqueClasses) {
    try {
      index[className] = resolver.resolve(className);
    } catch (error) {
      // Skip classes that can't be resolved
      if (logger) {
        logger.warn(`Warning: Could not resolve class ${className}: ${error.message}`);
      }
    }
  }

  return index;
}

/**
 * Generate canonical output from validated instances
 * @param {Array<Object>} instances - Validated instances
 * @param {ClassResolver} resolver - Class resolver for looking up class definitions
 * @param {Object} options - Generation options
 * @returns {Object} - Canonical output
 */
export function generateCanonical(instances, resolver, options = {}) {
  const {
    includeMetadata = true,
    includeClassIndex = true,
    includeValidation = false,
    timestamp = new Date().toISOString(),
    aspectLoader = null,
    logger = null
  } = options;

  // Merge instances with class defaults
  const objects = instances.map(instance => {
    if (!instance.class) {
      // No class field - return as-is (should not happen if filtered correctly)
      return instance;
    }
    
    try {
      const resolved = resolver.resolve(instance.class);
      return mergeInstanceWithFields(instance, resolved.fields);
    } catch (error) {
      // If class resolution fails, return instance as-is
      if (logger) {
        logger.warn(`Warning: Could not resolve class ${instance.class}: ${error.message}`);
      }
      return instance;
    }
  });

  // Build canonical structure
  const canonical = {
    objects
  };
  
  // Add instances_by_id for fast lookup (v1 compatibility)
  const instancesById = {};
  for (const obj of objects) {
    if (obj.id) {
      instancesById[obj.id] = obj;
    }
  }
  canonical.instances_by_id = instancesById;

  // Add class index with resolved class objects (not instance IDs)
  if (includeClassIndex) {
    canonical.classes_by_id = buildClassIndex(objects, resolver, logger);
  }

  // Add aspects_by_kind (first-class entities)
  if (aspectLoader && aspectLoader.aspects) {
    const aspectsByKind = {};
    for (const [aspectName, aspectDef] of aspectLoader.aspects.entries()) {
      aspectsByKind[aspectName] = {
        aspect: aspectName,
        description: aspectDef.schema?.description || null,
        pretty_name: aspectName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        schema: aspectDef.schema || {}
      };
    }
    canonical.aspects_by_kind = aspectsByKind;
  }

  // Add metadata
  if (includeMetadata) {
    canonical.metadata = {
      timestamp,
      version: '0.2.0-alpha',
      generator: 'struktur',
      count: objects.length,
      classes: Object.keys(canonical.classes_by_id || {}).length,
      aspects: aspectLoader ? aspectLoader.aspects.size : 0
    };
  }

  // Add validation metadata if requested
  if (includeValidation && options.validationResults) {
    const results = options.validationResults;
    canonical.validation = {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      errors: results.filter(r => !r.valid).map(r => ({
        instance: r.instance,
        class: r.class,
        errors: r.errors
      }))
    };
  }

  return canonical;
}

/**
 * Generate canonical output with validation
 * @param {Array<Object>} instances - Instances to validate and merge
 * @param {Object} struktur - Struktur instance with resolver and validator
 * @param {Object} options - Generation options
 * @returns {Object} - Canonical output with validation metadata
 */
export function generateCanonicalWithValidation(instances, struktur, options = {}) {
  // All instances must have class field for validation
  const validatableInstances = instances.filter(inst => inst.class);
  
  // Validate all instances
  const validationResults = validatableInstances.length > 0 
    ? struktur.validate(validatableInstances)
    : [];

  // Generate canonical with validated instances
  return generateCanonical(validatableInstances, struktur.classResolver, {
    ...options,
    aspectLoader: struktur.aspectLoader,
    includeValidation: true,
    validationResults,
    logger: options.logger || null
  });
}
