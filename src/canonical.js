/**
 * Canonical Output Generator
 *
 * Generates canonical.json output with merged instances and metadata
 */

import { createRequire } from 'module';
import { deepMerge } from './utils/deep_merge.js';
import { createLogger } from './utils/logger.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../package.json');

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
    
    // Auto-populate aspect_types from aspect keys for convenient filtering
    if (!merged.aspect_types && typeof instance.aspects === 'object') {
      merged.aspect_types = Object.keys(instance.aspects);
    }
  }

  return merged;
}

/**
 * Build class index with resolved class objects
 * @param {Array<Object>} instances - Merged instances
 * @param {ClassResolver} resolver - Class resolver for metadata
 * @param {Object} logger - Logger instance
 * @returns {Object} - Map of class name to resolved class object (not instance IDs)
 */
function buildClassIndex(instances, resolver, logger) {
  const index = {};
  const uniqueClasses = new Set();

  // Collect unique class names from instances
  for (const obj of instances) {
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
  const mergedInstances = instances.map(instance => {
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
    instances: mergedInstances
  };
  
  // Add instances_by_id for fast lookup
  const instancesById = {};
  for (const obj of mergedInstances) {
    if (obj.id) {
      instancesById[obj.id] = obj;
    }
  }
  canonical.instances_by_id = instancesById;

  // Add class index with resolved class objects (not instance IDs)
  if (includeClassIndex) {
    canonical.classes_by_id = buildClassIndex(mergedInstances, resolver, logger);
    // Also provide classes as array for consistency with instances
    canonical.classes = Object.values(canonical.classes_by_id);
  }

  // Add aspects_by_id (first-class entities)
  if (aspectLoader && aspectLoader.aspects) {
    const aspectsById = {};
    for (const [aspectName, aspectDef] of aspectLoader.aspects.entries()) {
      aspectsById[aspectName] = {
        aspect: aspectName,
        description: aspectDef.schema?.description || null,
        pretty_name: aspectName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        schema: aspectDef.schema || {}
      };
    }
    canonical.aspects_by_id = aspectsById;
    // Also provide aspects as array for consistency with instances
    canonical.aspects = Object.values(aspectsById);
  }

  // Add metadata
  if (includeMetadata) {
    canonical.metadata = {
      timestamp,
      version: PACKAGE_VERSION,
      generator: 'struktur',
      count: mergedInstances.length,
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
