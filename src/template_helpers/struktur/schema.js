/**
 * Struktur-Specific Helpers - Schema
 * 
 * Helpers for working with JSON schemas.
 * These require Struktur context (resolved classes).
 */

/**
 * Get all properties from a schema (traversing lineage)
 * @param {Object} schema - JSON Schema
 * @returns {Array<string>}
 */
function getSchemaProperties(schema) {
  if (!schema || !schema.properties) return [];
  return Object.keys(schema.properties);
}

/**
 * Get required fields from a schema
 * @param {Object} schema - JSON Schema
 * @returns {Array<string>}
 */
function getSchemaRequired(schema) {
  if (!schema || !Array.isArray(schema.required)) return [];
  return schema.required;
}

/**
 * Check if a field is required in class schema
 * @param {Object} context - Struktur context
 * @param {string} className - Class name
 * @param {string} fieldName - Field to check
 * @returns {boolean}
 */
export function schemaRequired(context, className, fieldName) {
  const { $classes_by_id } = context;
  if (!$classes_by_id || !className || !fieldName) return false;
  
  const classDef = $classes_by_id[className];
  if (!classDef) return false;
  
  // Check class and all parents
  const lineage = classDef.lineage || [className];
  
  for (const ancestorName of lineage) {
    const ancestor = $classes_by_id[ancestorName];
    if (ancestor?.schema) {
      const required = getSchemaRequired(ancestor.schema);
      if (required.includes(fieldName)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if schema has a property
 * @param {Object} context - Struktur context
 * @param {string} className - Class name
 * @param {string} fieldName - Field to check
 * @returns {boolean}
 */
export function schemaHas(context, className, fieldName) {
  const { $classes_by_id } = context;
  if (!$classes_by_id || !className || !fieldName) return false;
  
  const classDef = $classes_by_id[className];
  if (!classDef) return false;
  
  // Check class and all parents
  const lineage = classDef.lineage || [className];
  
  for (const ancestorName of lineage) {
    const ancestor = $classes_by_id[ancestorName];
    if (ancestor?.schema) {
      const props = getSchemaProperties(ancestor.schema);
      if (props.includes(fieldName)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get all properties from class schema (including inherited)
 * @param {Object} context - Struktur context
 * @param {string} className - Class name
 * @returns {Array<string>}
 */
export function schemaProps(context, className) {
  const { $classes_by_id } = context;
  if (!$classes_by_id || !className) return [];
  
  const classDef = $classes_by_id[className];
  if (!classDef) return [];
  
  const lineage = classDef.lineage || [className];
  const props = new Set();
  
  for (const ancestorName of lineage) {
    const ancestor = $classes_by_id[ancestorName];
    if (ancestor?.schema) {
      const ancestorProps = getSchemaProperties(ancestor.schema);
      ancestorProps.forEach(prop => props.add(prop));
    }
  }
  
  return Array.from(props).sort();
}

/**
 * Find which class in lineage defines a property
 * @param {Object} context - Struktur context
 * @param {string} className - Class name
 * @param {string} fieldName - Field to find
 * @returns {string} - Class name that defines the property, or empty string
 */
export function schemaPropSource(context, className, fieldName) {
  const { $classes_by_id } = context;
  if (!$classes_by_id || !className || !fieldName) return '';
  
  const classDef = $classes_by_id[className];
  if (!classDef) return '';
  
  const lineage = classDef.lineage || [className];
  
  for (const ancestorName of lineage) {
    const ancestor = $classes_by_id[ancestorName];
    if (ancestor?.schema) {
      const props = getSchemaProperties(ancestor.schema);
      if (props.includes(fieldName)) {
        return ancestorName;
      }
    }
  }
  
  return '';
}

/**
 * Get required fields grouped by source class
 * @param {Object} context - Struktur context
 * @param {string} className - Class name
 * @returns {Array<{class: string, required: Array<string>}>}
 */
export function schemaRequiredBySource(context, className) {
  const { $classes_by_id } = context;
  if (!$classes_by_id || !className) return [];
  
  const classDef = $classes_by_id[className];
  if (!classDef) return [];
  
  const lineage = classDef.lineage || [className];
  const result = [];
  
  for (const ancestorName of lineage) {
    const ancestor = $classes_by_id[ancestorName];
    if (ancestor?.schema) {
      const required = getSchemaRequired(ancestor.schema);
      if (required.length > 0) {
        result.push({
          class: ancestorName,
          required
        });
      }
    }
  }
  
  return result;
}
