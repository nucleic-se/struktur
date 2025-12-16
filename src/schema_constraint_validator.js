/**
 * Schema Constraint Validator
 * Detects logically impossible constraint combinations in merged schemas
 */

/**
 * Analyze schemas for constraint conflicts
 * @param {Array<Object>} schemas - Array of schemas in lineage order (root to leaf)
 * @param {Array<string>} lineage - Class lineage
 * @param {string} className - Current class name
 * @returns {Array<Object>} Array of conflicts
 */
export function analyzeSchemaConstraints(schemas, lineage, className) {
  const conflicts = [];
  const mergedConstraints = {};

  // Walk each schema and collect constraints by path
  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i];
    const fromClass = lineage[i];
    walkSchema(schema, '', (path, node, parent) => {
      if (!mergedConstraints[path]) {
        mergedConstraints[path] = [];
      }
      mergedConstraints[path].push({
        source: fromClass,
        constraints: node
      });
    });
  }

  // Check each path for conflicts
  for (const [path, entries] of Object.entries(mergedConstraints)) {
    // Numeric range conflicts
    const rangeConflict = checkNumericRangeConflict(path, entries, className, lineage);
    if (rangeConflict) conflicts.push(rangeConflict);

    // Enum conflicts
    const enumConflict = checkEnumConflict(path, entries, className, lineage);
    if (enumConflict) conflicts.push(enumConflict);

    // Type conflicts
    const typeConflict = checkTypeConflict(path, entries, className, lineage);
    if (typeConflict) conflicts.push(typeConflict);

    // String length conflicts
    const stringConflict = checkStringLengthConflict(path, entries, className, lineage);
    if (stringConflict) conflicts.push(stringConflict);

    // Array length conflicts
    const arrayConflict = checkArrayLengthConflict(path, entries, className, lineage);
    if (arrayConflict) conflicts.push(arrayConflict);
  }

  return conflicts;
}

/**
 * Check for numeric range conflicts (minimum > maximum)
 */
function checkNumericRangeConflict(path, entries, className, lineage) {
  let min = -Infinity;
  let max = Infinity;
  let minSource = null;
  let maxSource = null;

  for (const entry of entries) {
    const constraints = entry.constraints;
    if (constraints.minimum !== undefined) {
      if (constraints.minimum > min) {
        min = constraints.minimum;
        minSource = entry.source;
      }
    }
    if (constraints.maximum !== undefined) {
      if (constraints.maximum < max) {
        max = constraints.maximum;
        maxSource = entry.source;
      }
    }
    // exclusiveMinimum/exclusiveMaximum
    if (constraints.exclusiveMinimum !== undefined) {
      if (constraints.exclusiveMinimum >= min) {
        min = constraints.exclusiveMinimum + 0.000001; // Treat as slightly higher
        minSource = entry.source;
      }
    }
    if (constraints.exclusiveMaximum !== undefined) {
      if (constraints.exclusiveMaximum <= max) {
        max = constraints.exclusiveMaximum - 0.000001; // Treat as slightly lower
        maxSource = entry.source;
      }
    }
  }

  if (min > max) {
    return {
      class: className,
      type: 'RANGE_CONFLICT',
      path: path || '(root)',
      message: `minimum (${min}) > maximum (${max})`,
      details: {
        minimum: min,
        maximum: max,
        minSource,
        maxSource
      },
      lineage,
      severity: 'ERROR'
    };
  }

  return null;
}

/**
 * Check for enum conflicts (intersection is empty)
 */
function checkEnumConflict(path, entries, className, lineage) {
  const enumSets = [];
  const sources = [];

  for (const entry of entries) {
    if (entry.constraints.enum) {
      enumSets.push(new Set(entry.constraints.enum));
      sources.push(entry.source);
    }
    if (entry.constraints.const !== undefined) {
      enumSets.push(new Set([entry.constraints.const]));
      sources.push(entry.source);
    }
  }

  if (enumSets.length < 2) return null;

  // Calculate intersection
  let intersection = enumSets[0];
  for (let i = 1; i < enumSets.length; i++) {
    intersection = new Set([...intersection].filter(x => enumSets[i].has(x)));
  }

  if (intersection.size === 0) {
    return {
      class: className,
      type: 'ENUM_CONFLICT',
      path: path || '(root)',
      message: 'Merged enum constraints result in empty set (no valid values)',
      details: {
        sources: sources,
        enums: enumSets.map((s, i) => ({
          from: sources[i],
          values: Array.from(s)
        }))
      },
      lineage,
      severity: 'ERROR'
    };
  }

  return null;
}

/**
 * Check for type conflicts
 */
function checkTypeConflict(path, entries, className, lineage) {
  const types = [];
  const sources = [];

  for (const entry of entries) {
    if (entry.constraints.type) {
      const typeList = Array.isArray(entry.constraints.type) 
        ? entry.constraints.type 
        : [entry.constraints.type];
      types.push(new Set(typeList));
      sources.push(entry.source);
    }
  }

  if (types.length < 2) return null;

  // Group by source - if multiple type definitions come from the same source,
  // it's likely a oneOf/anyOf which is intentionally flexible
  const sourceMap = new Map();
  for (let i = 0; i < sources.length; i++) {
    if (!sourceMap.has(sources[i])) {
      sourceMap.set(sources[i], []);
    }
    sourceMap.get(sources[i]).push(types[i]);
  }

  // Only check conflicts between different sources
  if (sourceMap.size < 2) return null;

  const uniqueSources = Array.from(sourceMap.keys());
  const uniqueTypes = uniqueSources.map(s => {
    // Combine all types from this source (union)
    const allTypes = sourceMap.get(s);
    return new Set(allTypes.flatMap(t => Array.from(t)));
  });

  // Calculate intersection across different sources
  let intersection = uniqueTypes[0];
  for (let i = 1; i < uniqueTypes.length; i++) {
    intersection = new Set([...intersection].filter(x => uniqueTypes[i].has(x)));
  }

  if (intersection.size === 0) {
    return {
      class: className,
      type: 'TYPE_CONFLICT',
      path: path || '(root)',
      message: 'No compatible types remain after merge',
      details: {
        types: uniqueSources.map((source, i) => ({
          from: source,
          types: Array.from(uniqueTypes[i])
        }))
      },
      lineage,
      severity: 'ERROR'
    };
  }

  return null;
}

/**
 * Check for string length conflicts (minLength > maxLength)
 */
function checkStringLengthConflict(path, entries, className, lineage) {
  let minLength = 0;
  let maxLength = Infinity;
  let minSource = null;
  let maxSource = null;

  for (const entry of entries) {
    const constraints = entry.constraints;
    if (constraints.minLength !== undefined) {
      if (constraints.minLength > minLength) {
        minLength = constraints.minLength;
        minSource = entry.source;
      }
    }
    if (constraints.maxLength !== undefined) {
      if (constraints.maxLength < maxLength) {
        maxLength = constraints.maxLength;
        maxSource = entry.source;
      }
    }
  }

  if (minLength > maxLength) {
    return {
      class: className,
      type: 'STRING_LENGTH_CONFLICT',
      path: path || '(root)',
      message: `minLength (${minLength}) > maxLength (${maxLength})`,
      details: {
        minLength,
        maxLength,
        minSource,
        maxSource
      },
      lineage,
      severity: 'ERROR'
    };
  }

  return null;
}

/**
 * Check for array length conflicts (minItems > maxItems)
 */
function checkArrayLengthConflict(path, entries, className, lineage) {
  let minItems = 0;
  let maxItems = Infinity;
  let minSource = null;
  let maxSource = null;

  for (const entry of entries) {
    const constraints = entry.constraints;
    if (constraints.minItems !== undefined) {
      if (constraints.minItems > minItems) {
        minItems = constraints.minItems;
        minSource = entry.source;
      }
    }
    if (constraints.maxItems !== undefined) {
      if (constraints.maxItems < maxItems) {
        maxItems = constraints.maxItems;
        maxSource = entry.source;
      }
    }
  }

  if (minItems > maxItems) {
    return {
      class: className,
      type: 'ARRAY_LENGTH_CONFLICT',
      path: path || '(root)',
      message: `minItems (${minItems}) > maxItems (${maxItems})`,
      details: {
        minItems,
        maxItems,
        minSource,
        maxSource
      },
      lineage,
      severity: 'ERROR'
    };
  }

  return null;
}

/**
 * Walk schema tree and call callback for each node
 */
function walkSchema(schema, path, callback) {
  if (!schema || typeof schema !== 'object') return;

  callback(path, schema, null);

  // Walk properties
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const newPath = path ? `${path}.${key}` : key;
      walkSchema(value, newPath, callback);
    }
  }

  // Walk items (array schema)
  if (schema.items) {
    const newPath = path ? `${path}[*]` : '[*]';
    walkSchema(schema.items, newPath, callback);
  }

  // Walk patternProperties
  if (schema.patternProperties) {
    for (const [pattern, value] of Object.entries(schema.patternProperties)) {
      const newPath = path ? `${path}.<${pattern}>` : `<${pattern}>`;
      walkSchema(value, newPath, callback);
    }
  }

  // Walk additionalProperties
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const newPath = path ? `${path}.*` : '*';
    walkSchema(schema.additionalProperties, newPath, callback);
  }

  // Walk allOf, anyOf, oneOf
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    if (schema[keyword] && Array.isArray(schema[keyword])) {
      for (let i = 0; i < schema[keyword].length; i++) {
        walkSchema(schema[keyword][i], path, callback);
      }
    }
  }
}

/**
 * Format conflicts for display
 * @param {Array<Object>} conflicts - Array of conflicts
 * @returns {string} Formatted error message
 */
export function formatConflicts(conflicts) {
  if (conflicts.length === 0) {
    return '✓ No schema constraint conflicts detected';
  }

  const lines = [`❌ Schema Constraint Conflicts (${conflicts.length}):\n`];

  for (const conflict of conflicts) {
    lines.push(`  ${conflict.type}: ${conflict.class}`);
    lines.push(`    Path: ${conflict.path}`);
    lines.push(`    ${conflict.message}`);
    
    if (conflict.details) {
      if (conflict.details.minSource || conflict.details.maxSource) {
        lines.push(`    Sources: min from ${conflict.details.minSource}, max from ${conflict.details.maxSource}`);
      }
      if (conflict.details.enums) {
        for (const e of conflict.details.enums) {
          lines.push(`      ${e.from}: [${e.values.join(', ')}]`);
        }
      }
      if (conflict.details.types) {
        for (const t of conflict.details.types) {
          lines.push(`      ${t.from}: ${t.types.join(' | ')}`);
        }
      }
    }
    
    lines.push(`    Lineage: ${conflict.lineage.join(' → ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
