/**
 * Deep merge utility for class field defaults
 * 
 * PURPOSE: Merges field defaults across class inheritance hierarchy.
 * Unlike shallow Object.assign, this preserves all levels of nested defaults.
 * 
 * BEHAVIOR:
 * - Objects: Recursively merged (nested objects preserved)
 * - Arrays: Replaced entirely (source wins)
 * - Primitives: Last write wins
 * - Modifies target in place
 * 
 * NOTE: This is separate from instance_merger.js which has stricter
 * type checking, array concatenation, and path tracking for errors.
 * The two implementations serve different purposes:
 * - utils/deep_merge.js: Lenient merge for class defaults (design-time)
 * - instance_merger.js: Strict merge for instances (build-time, fail-fast)
 */

/**
 * Deep merge two objects
 * @param {Object} target - Target object (will be modified)
 * @param {Object} source - Source object
 * @returns {Object} - Merged result (same reference as target)
 */
export function deepMerge(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (isObject(sourceValue) && isObject(targetValue)) {
      // Both are objects - recurse
      target[key] = deepMerge({ ...targetValue }, sourceValue);
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
