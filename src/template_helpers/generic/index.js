/**
 * Generic Helpers Module
 * 
 * Aggregates and exports all generic template helpers.
 * These are pure functions that work identically across all template engines.
 */

import * as comparison from './comparison.js';
import * as strings from './strings.js';
import * as collections from './collections.js';
import * as utility from './utility.js';
import * as math from './math.js';

/**
 * All generic helpers
 */
export const genericHelpers = {
  // Comparison
  eq: comparison.eq,
  ne: comparison.ne,
  lt: comparison.lt,
  lte: comparison.lte,
  gt: comparison.gt,
  gte: comparison.gte,
  and: comparison.and,
  or: comparison.or,
  not: comparison.not,
  
  // Strings
  lowercase: strings.lowercase,
  uppercase: strings.uppercase,
  capitalize: strings.capitalize,
  title_case: strings.titleCase,
  slugify: strings.slugify,
  trim: strings.trim,
  split: strings.split,
  replace: strings.replace,
  escape: strings.escape,
  substring: strings.substring,
  
  // Collections
  where: collections.where,
  where_includes: collections.whereIncludes,
  sort_by: collections.sortBy,
  pluck: collections.pluck,
  flatten: collections.flatten,
  unique: collections.unique,
  group_by: collections.groupBy,
  first: collections.first,
  last: collections.last,
  reverse: collections.reverse,
  compact: collections.compact,
  length: collections.length,
  
  // Utility
  default_value: utility.defaultTo,
  array: utility.array,
  identity: utility.identity,
  json: utility.json,
  is_array: utility.isArray,
  is_object: utility.isObject,
  is_string: utility.isString,
  is_number: utility.isNumber,
  is_boolean: utility.isBoolean,
  is_nil: utility.isNil,
  type_of: utility.typeOf,
  values: utility.values,
  keys: utility.keys,
  lookup: utility.lookup,
  concat: utility.concat,
  exists: utility.exists,
  has: utility.has,
  get: utility.get,
  
  // Math
  add: math.add,
  sub: math.sub,
  abs: math.abs
};

/**
 * Register all generic helpers to a registry
 * @param {HelperRegistry} registry - Helper registry instance
 */
export function registerGenericHelpers(registry) {
  registry.registerMany(genericHelpers, {
    category: 'generic',
    requiresContext: false,
    requiresBuildContext: false
  });
  
  return registry;
}

/**
 * Get list of all generic helper names
 * @returns {Array<string>}
 */
export function getGenericHelperNames() {
  return Object.keys(genericHelpers);
}
