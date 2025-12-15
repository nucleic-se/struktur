/**
 * Deep merge utility for field defaults
 * 
 * Preserves nested object structure when merging field defaults across class hierarchy.
 * Unlike shallow Object.assign, this preserves all levels of nested defaults.
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
