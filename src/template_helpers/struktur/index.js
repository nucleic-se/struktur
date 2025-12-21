/**
 * Struktur-Specific Helpers Module
 * 
 * Aggregates and exports all struktur-specific template helpers.
 * These helpers need access to Struktur context ($classes_by_id, canonical, etc.).
 */

import * as inheritance from './inheritance.js';
import * as schema from './schema.js';

/**
 * All struktur-specific helpers
 */
export const strukturHelpers = {
  // Inheritance
  ...inheritance,
  
  // Schema
  ...schema
};

/**
 * Register all struktur helpers to a registry
 * @param {HelperRegistry} registry - Helper registry instance
 */
export function registerStrukturHelpers(registry) {
  registry.registerMany(strukturHelpers, {
    category: 'struktur',
    requiresContext: true,
    requiresBuildContext: false
  });
  
  return registry;
}

/**
 * Get list of all struktur helper names
 * @returns {Array<string>}
 */
export function getStrukturHelperNames() {
  return Object.keys(strukturHelpers);
}
