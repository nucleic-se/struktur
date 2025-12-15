/**
 * ClassResolver - Resolve class lineage without schema merging
 *
 * Key principle: Build lineage chain, keep schemas separate
 */

import { deepMerge } from './utils/deep_merge.js';

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

    const resolved = {
      class: className,
      lineage,
      schemas,
      fields,
      aspects,
      // Include metadata from class definition for viewer
      kinds: classDef.kinds || [],
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
      // Support both 'parent' (standard) and 'inherits_from' (legacy)
      const parents = classDef.parent || classDef.inherits_from;
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
        merged = deepMerge(merged, classDef.fields);
      }
    }

    return merged;
  }

  /**
   * Merge aspect requirements across lineage
   * @private
   * @param {Array<string>} lineage - Lineage chain
   * @returns {Array<string>}
   */
  _mergeAspects(lineage) {
    const aspectSet = new Set();

    for (const className of lineage) {
      const classDef = this.classLoader.getClass(className);
      if (classDef.aspects) {
        if (Array.isArray(classDef.aspects)) {
          // Handle array format: ["aspect1", "aspect2"]
          classDef.aspects.forEach(aspect => aspectSet.add(aspect));
        } else {
          // Handle object format: { aspect1: {required: true}, aspect2: {required: false} }
          Object.keys(classDef.aspects).forEach(aspect => aspectSet.add(aspect));
        }
      }
    }

    return Array.from(aspectSet);
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
