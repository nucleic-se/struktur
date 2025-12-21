/**
 * ClassLoader - Load class definitions without schema merging
 *
 * Key principle: Store schemas separately, no pre-merging
 */

import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';

export class ClassLoader {
  constructor() {
    /** @type {Map<string, ClassDefinition>} */
    this.classes = new Map();
  }

  /**
   * Load class definition from file
   * @param {string} filePath - Path to class definition JSON file
   * @returns {Promise<ClassDefinition>}
   */
  async loadClass(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const classDef = JSON.parse(content);

    // Validate required fields (check class field first)
    if (!classDef.$class) {
      throw new Error(`Class definition missing '$class' field: ${filePath}`);
    }

    if (!classDef.$schema) {
      throw new Error(`Class definition missing '$schema' field: ${filePath}`);
    }

    // Meta-validate schema against JSON Schema draft-07 (security: fail fast)
    try {
      const ajv = new Ajv({ strict: true, strictRequired: false, strictTypes: false, validateSchema: true, validateFormats: false });
      ajv.compile(classDef.$schema);
    } catch (error) {
      throw new Error(
        `Invalid JSON Schema in class '${classDef.$class}' (${filePath}): ${error.message}`
      );
    }

    // Check for duplicate class names
    if (this.classes.has(classDef.$class)) {

      throw new Error(
        `Duplicate class name '${classDef.$class}' found in ${filePath}. ` +
        'Already loaded from previous location.'
      );
    }

    // Store in registry (raw, no merging)
    this.classes.set(classDef.$class, classDef);

    return classDef;
  }

  /**
   * Load all classes from directory
   * @param {string} dirPath - Path to classes directory
   * @param {Object} [options] - Load options
   * @param {boolean} [options.recursive=true] - Load recursively
   * @returns {Promise<Array<ClassDefinition>>}
   */
  async loadClassesFromDirectory(dirPath, options = {}) {
    const { recursive = true } = options;
    const classes = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Sort alphabetically for deterministic loading order
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && recursive) {
          // Recurse into subdirectories
          const subClasses = await this.loadClassesFromDirectory(fullPath, options);
          classes.push(...subClasses);
        } else if (entry.isFile() && entry.name.endsWith('.class.json')) {
          try {
            const classDef = await this.loadClass(fullPath);
            classes.push(classDef);
          } catch (error) {
            throw new Error(`Failed to load class ${fullPath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, return empty array
        return classes;
      }
      throw error;
    }

    return classes;
  }

  /**
   * Get class definition by name
   * @param {string} className - Class name
   * @returns {ClassDefinition|undefined}
   */
  getClass(className) {
    return this.classes.get(className);
  }

  /**
   * Check if class exists
   * @param {string} className - Class name
   * @returns {boolean}
   */
  hasClass(className) {
    return this.classes.has(className);
  }

  /**
   * Get all loaded classes
   * @returns {Array<ClassDefinition>}
   */
  getAllClasses() {
    return Array.from(this.classes.values());
  }

  /**
   * Clear all loaded classes
   */
  clear() {
    this.classes.clear();
  }
}
