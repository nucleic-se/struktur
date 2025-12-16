/**
 * Generic Utility Helpers
 * 
 * Pure functions for common operations.
 * Work identically in all template engines.
 */

/**
 * Return default value if first value is null/undefined
 * @param {*} value - Value to check
 * @param {*} defaultValue - Default value to return
 * @returns {*}
 */
export function defaultTo(value, defaultValue) {
  return (value !== null && value !== undefined) ? value : defaultValue;
}

/**
 * Create an array from arguments
 * @param {...*} args - Values to put in array
 * @returns {Array}
 */
export function array(...args) {
  // Remove Handlebars options object if present
  return args[args.length - 1]?.hash !== undefined 
    ? args.slice(0, -1) 
    : args;
}

/**
 * Identity function - returns input unchanged
 * @param {*} value - Value to return
 * @returns {*}
 */
export function identity(value) {
  return value;
}

/**
 * Convert to JSON string
 * @param {*} value - Value to serialize
 * @param {number} [indent=2] - Indentation spaces
 * @returns {string}
 */
export function json(value, indent = 2) {
  try {
    return JSON.stringify(value, null, indent);
  } catch (error) {
    return String(value);
  }
}

/**
 * Check if value is an array
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isArray(value) {
  return Array.isArray(value);
}

/**
 * Concatenate all arguments into a string
 * @param {...*} args - Values to concatenate
 * @returns {string}
 */
export function concat(...args) {
  // Remove Handlebars options object if present
  const values = args[args.length - 1]?.hash !== undefined 
    ? args.slice(0, -1) 
    : args;
  
  return values.map(v => (v === null || v === undefined ? '' : String(v))).join('');
}

/**
 * Check if value is an object
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if value is a string
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isString(value) {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is boolean
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * Check if value is null or undefined
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isNil(value) {
  return value === null || value === undefined;
}

/**
 * Type of value
 * @param {*} value - Value to check
 * @returns {string}
 */
export function typeOf(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Get values from an object (Object.values)
 * @param {Object} obj - Object to get values from
 * @returns {Array}
 */
export function values(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.values(obj);
}

/**
 * Get keys from an object (Object.keys)
 * @param {Object} obj - Object to get keys from
 * @returns {Array<string>}
 */
export function keys(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj);
}

/**
 * Lookup helper - get property from object
 * @param {Object} obj - Object to lookup in
 * @param {string} key - Property key
 * @returns {*}
 */
export function lookup(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined;
  return obj[key];
}
