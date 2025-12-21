/**
 * ClassResolver - Resolve class lineage without schema merging
 *
 * Key principle: Build lineage chain, keep schemas separate
 */

import { classMerge } from './utils/class_merge.js';
import { analyzeSchemaConstraints, formatConflicts } from './schema_constraint_validator.js';

export class ClassResolver {
  constructor(classLoader) {
    this.classLoader = classLoader;
    /** @type {Map<string, ResolvedClass>} */
    this.resolvedCache = new Map();
  }

  /**
   * Resolve class to full lineage with separate schemas
   * @param {string} className - Class name to resolve
   * @returns {ResolvedClass}
   */
  resolve(className) {
    // Check cache
    if (this.resolvedCache.has(className)) {
      return this.resolvedCache.get(className);
    }

    const classDef = this.classLoader.getClass(className);
    if (!classDef) {
      throw new Error(`Class not found: ${className}`);
    }

    // Build lineage (root to leaf)
    const lineage = this._buildLineage(className);

    // Collect schemas (one per lineage entry, no merging)
    const schemas = lineage.map(name => {
      const def = this.classLoader.getClass(name);
      return def.schema;
    });

    // Merge fields (simple field defaults, not schemas)
    const fields = this._mergeFields(lineage);

    // Merge aspect requirements
    const aspects = this._mergeAspects(lineage);

    // Analyze schema constraints for conflicts (strict by default, fail fast)
    const schemaConflicts = analyzeSchemaConstraints(schemas, lineage, className);
    if (schemaConflicts.length > 0) {
      const message = formatConflicts(schemaConflicts);
      throw new Error(`Schema constraint conflicts detected in class ${className}:\n${message}`);
    }

    const resolved = {
      class: className,
      lineage,
      schemas,
      fields,
      $aspects: aspects,
      // Include metadata from class definition for viewer
      $uses_aspects: this._mergeAspectTypes(lineage),
      $aspect_defaults: this._mergeAspectDefaults(lineage),
      pretty_name: classDef.pretty_name || className,
      domains: classDef.domains || [],
      parent: lineage.slice(0, -1)  // All parents in lineage order
    };

    // Cache result
    this.resolvedCache.set(className, resolved);

    return resolved;
  }

  /**
   * Build lineage chain from root to leaf
   * @private
   * @param {string} className - Class name
   * @returns {Array<string>}
   */
  _buildLineage(className) {
    const lineage = [];
    const visited = new Set();
    const queue = [[className, new Set([className])]]; // [className, ancestorPath]

    // Process classes in breadth-first order for multi-parent support
    while (queue.length > 0) {
      const [current, ancestors] = queue.shift();

      // Skip if already processed (diamond inheritance is valid)
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      lineage.unshift(current); // Add to front (parents before children)

      const classDef = this.classLoader.getClass(current);
      if (!classDef) {
        throw new Error(`Class not found in lineage: ${current}`);
      }

      // Handle both single parent (string) and multi-parent (array)
      const parents = classDef.parent;
      if (parents) {
        const parentArray = Array.isArray(parents) ? parents : [parents];
        for (const parent of parentArray) {
          // Detect true circular inheritance (parent is in our ancestor chain)
          if (ancestors.has(parent)) {
            throw new Error(`Circular inheritance detected: ${parent}`);
          }
          // Add to queue if not already visited (diamond inheritance is OK)
          if (!visited.has(parent)) {
            const newAncestors = new Set(ancestors);
            newAncestors.add(parent);
            queue.push([parent, newAncestors]);
          }
        }
      }
    }

    return lineage;
  }

  /**
   * Merge field defaults across lineage (deep merge)
   * @private
   * @param {Array<string>} lineage - Lineage chain
   * @returns {Object.<string, any>}
   */
  _mergeFields(lineage) {
    let merged = {};

    for (const className of lineage) {
      const classDef = this.classLoader.getClass(className);
      if (classDef.fields) {
        merged = classMerge(merged, classDef.fields);
      }
    }

    return merged;
  }

  /**
   * Merge aspect requirements across lineage
   * @private
   * @param {Array<string>} lineage - Lineage chain
   * @returns {Object.<string, {required: boolean}>}
   */
  _mergeAspects(lineage) {
    const aspectMap = {};

    for (const className of lineage) {
      const classDef = this.classLoader.getClass(className);
      if (classDef.$aspects) {
        if (Array.isArray(classDef.$aspects)) {
          // Handle array format: ["aspect1", "aspect2"] - assume optional
          classDef.$aspects.forEach(aspect => {
            if (!aspectMap[aspect]) {
              aspectMap[aspect] = { required: false };
            }
          });
        } else {
          // Handle object format: { aspect1: {required: true}, aspect2: {required: false} }
          for (const [aspectName, aspectConfig] of Object.entries(classDef.$aspects)) {
            // Parent required=true takes precedence over child required=false
            if (!aspectMap[aspectName]) {
              aspectMap[aspectName] = { required: aspectConfig.required === true };
            } else if (aspectConfig.required === true) {
              // Override if this layer requires it (parent wins)
              aspectMap[aspectName].required = true;
            }
          }
        }
      }
    }

    return aspectMap;
  }

  /**
   * Accumulate $uses_aspects across lineage
   * @private
   * @param {Array<string>} lineage - Lineage chain (base → child order)
   * @returns {Array<string>} - Accumulated $uses_aspects, deduplicated
   */
  _mergeAspectTypes(lineage) {
    const accumulated = [];
    const seen = new Set();

    // Traverse lineage in order (base → child)
    for (const className of lineage) {
      const classDef = this.classLoader.getClass(className);
      const aspectTypes = classDef.$uses_aspects || [];

      // Add new $uses_aspects, deduplicate
      for (const aspectType of aspectTypes) {
        if (!seen.has(aspectType)) {
          seen.add(aspectType);
          accumulated.push(aspectType);
        }
      }
    }

    return accumulated;
  }

  /**
   * Accumulate $aspect_defaults across lineage
   * @private
   * @param {Array<string>} lineage - Lineage chain (base → child order)
   * @returns {Object.<string, Object>} - Merged aspect defaults by aspect name
   */
  _mergeAspectDefaults(lineage) {
    const merged = {};

    // Traverse lineage in order (base → child, child wins)
    for (const className of lineage) {
      const classDef = this.classLoader.getClass(className);
      if (classDef.$aspect_defaults) {
        // Deep merge each aspect's defaults
        for (const [aspectName, defaults] of Object.entries(classDef.$aspect_defaults)) {
          if (!merged[aspectName]) {
            merged[aspectName] = {};
          }
          merged[aspectName] = classMerge(merged[aspectName], defaults);
        }
      }
    }

    return Object.keys(merged).length > 0 ? merged : {};
  }

  /**
   * Clear resolution cache
   */
  clearCache() {
    this.resolvedCache.clear();
  }

  /**
   * Resolve multiple classes
   * @param {Array<string>} classNames - Array of class names
   * @returns {Array<ResolvedClass>}
   */
  resolveMany(classNames) {
    return classNames.map(name => this.resolve(name));
  }
}
