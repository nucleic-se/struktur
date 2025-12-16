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

/**
 * All generic helpers
 */
export const genericHelpers = {
  // Comparison
  ...comparison,
  
  // Strings
  ...strings,
  title_case: strings.titleCase, // Alias for snake_case convention
  upper: strings.uppercase, // Alias for documentation
  lower: strings.lowercase, // Alias for documentation
  
  // Collections
  ...collections,
  where_includes: collections.whereIncludes, // Alias for snake_case convention
  sort_by: collections.sortBy, // Alias for snake_case convention
  group_by: collections.groupBy, // Alias for snake_case convention
  
  // Utility
  ...utility,
  default: utility.defaultTo // Alias for documentation compatibility
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
