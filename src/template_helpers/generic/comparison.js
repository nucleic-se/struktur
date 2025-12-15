/**
 * Generic Comparison Helpers
 * 
 * Pure functions for equality and boolean logic.
 * Work identically in all template engines.
 */

/**
 * Check if two values are strictly equal
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean}
 */
export function eq(a, b) {
  return a === b;
}

/**
 * Check if two values are not equal
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean}
 */
export function ne(a, b) {
  return a !== b;
}

/**
 * Check if first value is less than second
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean}
 */
export function lt(a, b) {
  return a < b;
}

/**
 * Check if first value is less than or equal to second
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean}
 */
export function lte(a, b) {
  return a <= b;
}

/**
 * Check if first value is greater than second
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean}
 */
export function gt(a, b) {
  return a > b;
}

/**
 * Check if first value is greater than or equal to second
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean}
 */
export function gte(a, b) {
  return a >= b;
}

/**
 * Logical AND - all arguments must be truthy
 * Note: For Handlebars, options object will be last argument
 * @param {...*} args - Values to check
 * @returns {boolean}
 */
export function and(...args) {
  // Remove Handlebars options object if present
  const values = args[args.length - 1]?.hash !== undefined 
    ? args.slice(0, -1) 
    : args;
  
  return values.every(Boolean);
}

/**
 * Logical OR - at least one argument must be truthy
 * @param {...*} args - Values to check
 * @returns {boolean}
 */
export function or(...args) {
  // Remove Handlebars options object if present
  const values = args[args.length - 1]?.hash !== undefined 
    ? args.slice(0, -1) 
    : args;
  
  return values.some(Boolean);
}

/**
 * Logical NOT - invert truthiness
 * @param {*} value - Value to invert
 * @returns {boolean}
 */
export function not(value) {
  return !value;
}
