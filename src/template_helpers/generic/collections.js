/**
 * Generic Collection Helpers
 * 
 * Pure functions for array/object manipulation.
 * Work identically in all template engines.
 */

/**
 * Get value at path in object
 * @param {Object} obj - Object to traverse
 * @param {string} pathStr - Dot-separated path
 * @returns {*}
 */
function getByPath(obj, pathStr) {
  if (!obj || !pathStr) return undefined;
  
  const keys = String(pathStr).split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Filter array by property value
 * @param {Array|Object} list - Array or object to filter
 * @param {string} pathStr - Property path
 * @param {*} value - Value to match
 * @returns {Array}
 */
export function where(list, pathStr, value) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  
  // If no value provided, filter for truthy values
  if (arguments.length < 3) {
    return array.filter(item => Boolean(item));
  }
  
  return array.filter(item => getByPath(item, pathStr) === value);
}

/**
 * Filter array where property includes value
 * @param {Array|Object} list - Array or object to filter
 * @param {string} pathStr - Property path
 * @param {*} needle - Value to find
 * @returns {Array}
 */
export function whereIncludes(list, pathStr, needle) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  
  return array.filter(item => {
    const target = pathStr ? getByPath(item, pathStr) : item;
    
    if (Array.isArray(target)) {
      return target.includes(needle);
    }
    
    if (typeof target === 'string') {
      return target.includes(String(needle));
    }
    
    return false;
  });
}

/**
 * Sort array by property value
 * @param {Array|Object} list - Array or object to sort
 * @param {string} pathStr - Property path to sort by
 * @param {Object} options - Options {reverse: boolean}
 * @returns {Array}
 */
export function sortBy(list, pathStr, options = {}) {
  const array = Array.isArray(list) ? [...list] : Object.values(list || {});
  
  const sorted = array.sort((a, b) => {
    const aVal = pathStr ? getByPath(a, pathStr) : a;
    const bVal = pathStr ? getByPath(b, pathStr) : b;
    
    // Handle null/undefined
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    
    // String comparison
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal);
    }
    
    // Numeric comparison
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
  
  return options.reverse ? sorted.reverse() : sorted;
}

/**
 * Pluck property from array of objects
 * @param {Array|Object} list - Array or object
 * @param {string} fieldPath - Property path to pluck
 * @returns {Array}
 */
export function pluck(list, fieldPath) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  
  return array
    .map(item => getByPath(item, fieldPath))
    .filter(v => v !== undefined);
}

/**
 * Flatten array one level deep
 * @param {Array|Object} list - Array or object to flatten
 * @returns {Array}
 */
export function flatten(list) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  
  return array.reduce((acc, item) => {
    if (Array.isArray(item)) {
      return acc.concat(item);
    }
    return acc.concat([item]);
  }, []);
}

/**
 * Get unique values from array
 * @param {Array|Object} list - Array or object
 * @returns {Array}
 */
export function unique(list) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  
  const seen = new Set();
  const result = [];
  
  for (const item of array) {
    const key = typeof item === 'object' ? JSON.stringify(item) : item;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  // Sort primitives
  if (result.length > 0 && typeof result[0] !== 'object') {
    return result.sort();
  }
  
  return result;
}

/**
 * Group array by property value
 * @param {Array|Object} list - Array or object to group
 * @param {string} pathStr - Property path to group by
 * @returns {Array<{key: string, items: Array}>}
 */
export function groupBy(list, pathStr) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  
  if (!pathStr) {
    return [];
  }
  
  const groups = new Map();
  
  array.forEach(entry => {
    const raw = getByPath(entry, pathStr);
    const values = Array.isArray(raw) ? raw : [raw];
    
    values.forEach(val => {
      if (val === undefined || val === null) {
        return;
      }
      
      const key = String(val);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(entry);
    });
  });
  
  return Array.from(groups.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { 
      numeric: true, 
      sensitivity: 'base' 
    }))
    .map(([key, items]) => ({ key, items }));
}

/**
 * Get first item from array
 * @param {Array} array - Array
 * @returns {*}
 */
export function first(array) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  return array[0];
}

/**
 * Get last item from array
 * @param {Array} array - Array
 * @returns {*}
 */
export function last(array) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  return array[array.length - 1];
}

/**
 * Reverse array
 * @param {Array|Object} list - Array or object
 * @returns {Array}
 */
export function reverse(list) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  return array.slice().reverse();
}

/**
 * Remove falsy values from array
 * @param {Array|Object} list - Array or object
 * @returns {Array}
 */
export function compact(list) {
  const array = Array.isArray(list) ? list : Object.values(list || {});
  return array.filter(Boolean);
}

/**
 * Get length of array or object
 * @param {Array|Object|string} value - Value to measure
 * @returns {number}
 */
export function length(value) {
  if (Array.isArray(value)) {
    return value.length;
  }
  
  if (value && typeof value === 'object') {
    return Object.keys(value).length;
  }
  
  if (typeof value === 'string') {
    return value.length;
  }
  
  return 0;
}
