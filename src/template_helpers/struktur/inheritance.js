/**
 * Struktur-Specific Helpers - Inheritance
 * 
 * Helpers for working with class inheritance hierarchies.
 * These require Struktur context (resolved classes).
 */

/**
 * Check if a class inherits from target class(es)
 * @param {Object} context - Struktur context with classes_by_id
 * @param {string} className - Class to check
 * @param {string|Array<string>} targetClasses - Target class(es) to check against
 * @returns {boolean}
 */
export function inherits(context, className, targetClasses) {
  const { classes_by_id } = context;
  if (!classes_by_id || !className) return false;
  
  const classDef = classes_by_id.get(className);
  if (!classDef) return false;
  
  const targets = Array.isArray(targetClasses) ? targetClasses : [targetClasses];
  const lineage = classDef.lineage || [className];
  
  return targets.every(target => lineage.includes(target));
}

/**
 * Filter instances by inheritance
 * @param {Object} context - Struktur context
 * @param {Array|Object} entries - Instances to filter
 * @param {string|Array<string>} targetClasses - Target class(es)
 * @returns {Array}
 */
export function filterInherits(context, entries, targetClasses) {
  const array = Array.isArray(entries) ? entries : Object.values(entries || {});
  const targets = Array.isArray(targetClasses) ? targetClasses : [targetClasses];
  
  return array.filter(entry => {
    if (!entry.class) return false;
    return inherits(context, entry.class, targets);
  });
}

/**
 * Get class lineage (inheritance chain)
 * @param {Object} context - Struktur context
 * @param {string} className - Class name
 * @returns {Array<string>}
 */
export function classLineage(context, className) {
  const { classes_by_id } = context;
  if (!classes_by_id || !className) return [];
  
  const classDef = classes_by_id.get(className);
  if (!classDef) return [];
  
  return classDef.lineage || [className];
}
