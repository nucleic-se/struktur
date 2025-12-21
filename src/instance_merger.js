/**
 * Instance Merger - Merge multiple instances with same ID
 * 
 * Merges instance data from multiple source files (e.g., base stack + overlay).
 * This is intentionally different from utils/class_merge.js.
 * 
 * USE CASE: Merging multi-file instance definitions at build time
 * 
 * BEHAVIOR:
 * - Objects: Deep merge recursively (nested objects preserved)
 * - Arrays: Concatenated + deduped (primitives only)
 * - Primitives: Last write wins (source overrides target)
 * - Strict: Type checking with fail-fast on mismatch
 * 
 * COMPARISON TO utils/class_merge.js:
 * 
 * | Aspect       | instance_merger.js | class_merge.js     |
 * |--------------|--------------------|--------------------|
 * | Purpose      | Instance data      | Class defaults     |
 * | Arrays       | Concatenate        | Replace            |
 * | Type safety  | Strict (fail-fast) | Lenient (no check) |
 * | Errors       | Throw with path    | Silent replacement |
 * | When         | Build-time         | Design-time        |
 * 
 * EXAMPLES:
 * 
 * Instance merge (arrays concat):
 *   File1: { tags: ['a'] }
 *   File2: { tags: ['b'] }
 *   Result: { tags: ['a', 'b'] }  // Both kept
 * 
 * Class inheritance (arrays replace):
 *   Parent: { ports: [80] }
 *   Child:  { ports: [443] }
 *   Result: { ports: [443] }  // Child wins
 * 
 * Type conflict detection:
 *   File1: { value: "string" }
 *   File2: { value: 123 }
 *   Result: Error "Type conflict at value: cannot merge string with number"
 * 
 * @module instance_merger
 */

/**
 * Deep merge two objects with strict type checking
 * @param {any} target - Base value
 * @param {any} source - Value to merge in
 * @param {string} path - Current path for error messages
 * @returns {any} Merged result
 */
function deepMerge(target, source, path = '') {
  // Handle primitives and nulls
  if (source === null || source === undefined) {
    return target;
  }
  
  if (target === null || target === undefined) {
    return source;
  }
  
  const targetType = Array.isArray(target) ? 'array' : typeof target;
  const sourceType = Array.isArray(source) ? 'array' : typeof source;
  
  // Fail fast: type mismatch (except both objects)
  if (targetType !== sourceType) {
    throw new Error(
      `Type conflict at ${path || 'root'}: cannot merge ${targetType} with ${sourceType}`
    );
  }
  
  // Arrays: concatenate and dedupe
  if (Array.isArray(target)) {
    const merged = [...target, ...source];
    // Dedupe: keep first occurrence of primitives, all objects
    const seen = new Set();
    return merged.filter(item => {
      if (typeof item === 'object' && item !== null) {
        return true; // Keep all objects
      }
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  // Objects: deep merge recursively
  if (typeof target === 'object') {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const newPath = path ? `${path}.${key}` : key;
      if (key in result) {
        result[key] = deepMerge(result[key], source[key], newPath);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  
  // Scalars: last wins
  return source;
}

/**
 * Merge instances with same ID
 * @param {Array<Object>} instances - All instances from all sources
 * @returns {Array<Object>} Merged instances
 */
export function mergeInstances(instances) {
  const byId = new Map();
  
  for (const inst of instances) {
    if (!inst.$id) {
      throw new Error('Instance missing required "$id" field');
    }
    
    if (!byId.has(inst.$id)) {
      byId.set(inst.$id, {
        merged: { ...inst },
        sources: [inst.$source_file || 'unknown']
      });
    } else {
      const existing = byId.get(inst.$id);
      
      // Fail fast: class mismatch
      if (inst.$class && existing.merged.$class && existing.merged.$class !== inst.$class) {
        throw new Error(
          `Instance '${inst.$id}' has conflicting classes:\n` +
          `  ${existing.merged.$class} in ${existing.sources[0]}\n` +
          `  ${inst.$class} in ${inst.$source_file || 'unknown'}\n` +
          `\n` +
          `Tip: Use explicit flags to compose stacks at class level:\n` +
          `  struktur build -c stack1/classes -c stack2/classes -i stack2/instances`
        );
      }
      
      try {
        existing.merged = deepMerge(existing.merged, inst, inst.$id);
        existing.sources.push(inst.$source_file || 'unknown');
      } catch (error) {
        throw new Error(
          `Failed to merge instance '${inst.$id}': ${error.message}\n` +
          `  Sources: ${existing.sources.join(', ')}, ${inst.$source_file || 'unknown'}`
        );
      }
    }
  }
  
  // Return merged instances with source tracking
  return Array.from(byId.values()).map(({ merged, sources }) => ({
    ...merged,
    $merged_from: sources.length > 1 ? sources : undefined
  }));
}

/**
 * Get merge statistics for reporting
 * @param {Array<Object>} instances - Original instances
 * @param {Array<Object>} merged - Merged instances
 * @returns {Object} Statistics
 */
export function getMergeStats(instances, merged) {
  const mergedCount = merged.filter(m => m.$merged_from).length;
  const totalSources = instances.length;
  const uniqueInstances = merged.length;
  
  return {
    totalSources,
    uniqueInstances,
    mergedCount,
    reduction: totalSources - uniqueInstances
  };
}
