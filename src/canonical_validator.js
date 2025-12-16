/**
 * Canonical structure validator
 * Validates canonical.json output against JSON Schema
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load canonical structure schema
 * @returns {Promise<Object>} JSON Schema
 */
async function loadSchema() {
  const schemaPath = path.join(__dirname, '../schemas/canonical_structure.schema.json');
  const schemaContent = await fs.readFile(schemaPath, 'utf-8');
  return JSON.parse(schemaContent);
}

/**
 * Validate canonical structure
 * @param {Object} canonical - Canonical output to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export async function validateCanonical(canonical, options = {}) {
  const { strict = true } = options;
  
  const schema = await loadSchema();
  const ajv = new Ajv({ 
    strict: strict,
    allErrors: true,
    verbose: true
  });
  
  // Add format validators (date-time, email, etc.)
  addFormats(ajv);
  
  const validate = ajv.compile(schema);
  const valid = validate(canonical);
  
  return {
    valid,
    errors: validate.errors || [],
    schema: schema.$id || 'canonical_structure'
  };
}

/**
 * Format validation errors for display
 * @param {Object} result - Validation result from validateCanonical
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(result) {
  if (result.valid) {
    return '✓ Canonical structure is valid';
  }
  
  const lines = ['❌ Canonical structure validation failed:\n'];
  
  for (const error of result.errors) {
    const path = error.instancePath || '/';
    const message = error.message || 'validation error';
    
    lines.push(`  • ${path}: ${message}`);
    
    if (error.params) {
      const params = Object.entries(error.params)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(', ');
      lines.push(`    (${params})`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Validate canonical file
 * @param {string} filePath - Path to canonical.json
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
export async function validateCanonicalFile(filePath, options = {}) {
  const content = await fs.readFile(filePath, 'utf-8');
  const canonical = JSON.parse(content);
  return validateCanonical(canonical, options);
}
