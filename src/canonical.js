/**
 * Canonical Output Generator
 *
 * Generates canonical.json output with merged instances and metadata
 */

import { createRequire } from 'module';
import { classMerge } from './utils/class_merge.js';
import { createLogger } from './utils/logger.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../package.json');

/**
 * Merge instance with class field defaults and aspect defaults
 * @param {Object} instance - Instance data
 * @param {Object} resolvedClass - Resolved class with fields and $aspect_defaults
 * @param {Object} aspectLoader - Aspect loader for aspect definitions
 * @returns {Object} - Merged instance
 */
function mergeInstanceWithFields(instance, resolvedClass = {}, aspectLoader = null) {
  const fields = resolvedClass.fields || {};
  
  // Deep merge: start with empty object, merge defaults, then instance (instance wins)
  const merged = classMerge(classMerge({}, fields), instance);

  // Three-layer aspect data merge
  // Collect all aspect names from: instance, class $uses_aspects, class $aspect_defaults
  const allAspectNames = new Set();
  
  if (instance.$aspects && typeof instance.$aspects === 'object') {
    Object.keys(instance.$aspects).forEach(name => allAspectNames.add(name));
  }
  
  if (resolvedClass.$uses_aspects && Array.isArray(resolvedClass.$uses_aspects)) {
    resolvedClass.$uses_aspects.forEach(name => allAspectNames.add(name));
  }
  
  if (resolvedClass.$aspect_defaults) {
    Object.keys(resolvedClass.$aspect_defaults).forEach(name => allAspectNames.add(name));
  }
  
  if (allAspectNames.size > 0) {
    merged.$aspects = {};
    
    for (const aspectName of allAspectNames) {
      let aspectData = {};
      
      // Layer 1: Aspect definition defaults (from aspect file)
      if (aspectLoader && aspectLoader.aspects) {
        // Aspect definitions are stored with "aspect_" prefix, but instances use them without
        const aspectKey = aspectName.startsWith('aspect_') ? aspectName : `aspect_${aspectName}`;
        const aspectDef = aspectLoader.aspects.get(aspectKey);
        if (aspectDef) {
          const { aspect, schema, ...defaults } = aspectDef;
          aspectData = classMerge(aspectData, defaults);
        }
      }
      
      // Layer 2: Class hierarchy $aspect_defaults (from resolved class)
      if (resolvedClass.$aspect_defaults && resolvedClass.$aspect_defaults[aspectName]) {
        aspectData = classMerge(aspectData, resolvedClass.$aspect_defaults[aspectName]);
      }
      
      // Layer 3: Instance aspect values (always win)
      if (instance.$aspects && instance.$aspects[aspectName]) {
        aspectData = classMerge(aspectData, instance.$aspects[aspectName]);
      }
      
      merged.$aspects[aspectName] = aspectData;
    }
    
    // Auto-populate $uses_aspects from all merged aspects for convenient filtering
    if (!merged.$uses_aspects) {
      merged.$uses_aspects = Array.from(allAspectNames);
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
      return mergeInstanceWithFields(instance, resolved, aspectLoader);
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
      // Extract defaults: all top-level fields except 'aspect' and 'schema'
      const { aspect, schema, ...defaults } = aspectDef;
      
      aspectsById[aspectName] = {
        aspect: aspectName,
        description: schema?.description || null,
        pretty_name: aspectName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        schema: schema || {},
        defaults: Object.keys(defaults).length > 0 ? defaults : null
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
