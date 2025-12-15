/**
 * Generic String Helpers
 * 
 * Pure functions for string manipulation.
 * Work identically in all template engines.
 */

/**
 * Convert string to lowercase
 * @param {*} value - Value to convert
 * @returns {string}
 */
export function lowercase(value) {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

/**
 * Convert string to uppercase
 * @param {*} value - Value to convert
 * @returns {string}
 */
export function uppercase(value) {
  if (value === null || value === undefined) return '';
  return String(value).toUpperCase();
}

/**
 * Capitalize first letter
 * @param {*} value - Value to capitalize
 * @returns {string}
 */
export function capitalize(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert to title case (capitalize each word)
 * @param {*} value - Value to convert
 * @returns {string}
 */
export function titleCase(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .replace(/(^|\s|[_-])(\w)/g, (_m, sep, ch) => `${sep ? ' ' : ''}${ch.toUpperCase()}`)
    .trim();
}

/**
 * Convert to slug (lowercase, hyphenated)
 * @param {*} value - Value to slugify
 * @returns {string}
 */
export function slugify(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Trim whitespace from both ends
 * @param {*} value - Value to trim
 * @returns {string}
 */
export function trim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Split string by delimiter
 * @param {*} value - String to split
 * @param {string} delimiter - Delimiter to split on
 * @param {number} [index] - Optional index to return
 * @returns {Array<string>|string}
 */
export function split(value, delimiter, index) {
  if (value === null || value === undefined) return '';
  const parts = String(value).split(String(delimiter || ''));
  
  if (index === undefined || index === null) {
    return parts;
  }
  
  const idx = Number(index);
  return parts[idx] !== undefined ? parts[idx] : '';
}

/**
 * Replace all occurrences in string
 * @param {*} value - String to search
 * @param {string} searchValue - Value to find
 * @param {string} replaceValue - Value to replace with
 * @returns {string}
 */
export function replace(value, searchValue, replaceValue) {
  if (value === null || value === undefined) return '';
  if (searchValue === null || searchValue === undefined) return String(value);
  
  const str = String(value);
  const search = String(searchValue);
  const replacement = replaceValue === null || replaceValue === undefined ? '' : String(replaceValue);
  
  return str.split(search).join(replacement);
}

/**
 * Escape HTML special characters
 * Note: In Handlebars context, this will be provided by the engine
 * but we provide a basic implementation for other engines
 * @param {*} value - Value to escape
 * @returns {string}
 */
export function escape(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Get substring
 * @param {*} value - String to extract from
 * @param {number} start - Start index
 * @param {number} [end] - End index (optional)
 * @returns {string}
 */
export function substring(value, start, end) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const startIdx = start === null || start === undefined ? 0 : Number(start);
  
  if (end === null || end === undefined) {
    return str.substring(startIdx);
  }
  
  return str.substring(startIdx, Number(end));
}
