/**
 * Class Field Merge Utility
 * 
 * Merges field defaults during class inheritance resolution.
 * This is intentionally different from instance_merger.js deepMerge().
 * 
 * USE CASE: Resolving class field defaults through inheritance chain
 * 
 * BEHAVIOR:
 * - Objects: Recursively merged (nested objects preserved)
 * - Arrays: Replaced entirely (child wins, not concatenated)
 * - Primitives: Last write wins (child overrides parent)
 * - Lenient: No type checking or error throwing
 * 
 * COMPARISON TO instance_merger.js deepMerge():
 * 
 * | Aspect       | class_merge.js     | instance_merger.js |
 * |--------------|--------------------|--------------------|  
 * | Purpose      | Class defaults     | Instance data      |
 * | Arrays       | Replace            | Concatenate        |
 * | Type safety  | Lenient (no check) | Strict (fail-fast) |
 * | Errors       | Silent replacement | Throw with path    |
 * | When         | Design-time        | Build-time         |
 * 
 * EXAMPLES:
 * 
 * Class inheritance (arrays replace):
 *   Parent: { ports: [80] }
 *   Child:  { ports: [443] }
 *   Result: { ports: [443] }  // Child wins
 * 
 * Instance merge (arrays concat):
 *   File1: { tags: ['a'] }
 *   File2: { tags: ['b'] }
 *   Result: { tags: ['a', 'b'] }  // Both kept
 * 
 * @module class_merge
 */

/**
 * Merge class field defaults
 * @param {Object} target - Target object (will be modified)
 * @param {Object} source - Source object
 * @returns {Object} - Merged result (same reference as target)
 */
export function classMerge(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (isObject(sourceValue) && isObject(targetValue)) {
      // Both are objects - recurse
      target[key] = classMerge({ ...targetValue }, sourceValue);
    } else {
      // Primitive or array - replace
      target[key] = sourceValue;
    }
  }

  return target;
}

/**
 * Check if value is a plain object (not array, null, Date, etc.)
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
