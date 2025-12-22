/**
 * Generic Math Helpers
 * 
 * Simple numeric operations for templates.
 */

/**
 * Add two numbers
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {number}
 */
export function add(a, b) {
  return Number(a) + Number(b);
}

/**
 * Subtract second number from first
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {number}
 */
export function sub(a, b) {
  return Number(a) - Number(b);
}

/**
 * Absolute value
 * @param {*} value - Value to convert
 * @returns {number}
 */
export function abs(value) {
  return Math.abs(Number(value));
}
