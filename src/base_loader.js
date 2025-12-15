import fs from 'fs/promises';
import path from 'path';

/**
 * Base loader for classes and aspects
 * Provides common functionality for loading definitions from filesystem
 */
export class BaseLoader {
  constructor(entityType, requiredFields) {
    this.entityType = entityType; // 'class' or 'aspect'
    this.requiredFields = requiredFields;
    this.registry = new Map();
  }

  /**
   * Load a single entity definition from file
   * @param {string} filePath - Path to entity file
   * @returns {Promise<Object>} Entity definition
   */
  async loadEntity(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const entity = JSON.parse(content);

      // Validate required fields
      for (const field of this.requiredFields) {
        if (!entity[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Store in registry
      const entityName = entity[this.requiredFields[0]]; // First field is the name
      this.registry.set(entityName, entity);

      return entity;
    } catch (error) {
      throw new Error(`Failed to load ${this.entityType} ${filePath}: ${error.message}`);
    }
  }

  /**
   * Load all entities from a directory
   * @param {string} dirPath - Directory path
   * @param {boolean} recursive - Whether to scan recursively (default: true)
   * @returns {Promise<Array<Object>>} Array of loaded entities
   */
  async loadEntitiesFromDirectory(dirPath, recursive = true) {
    try {
      await fs.access(dirPath);
    } catch {
      return []; // Directory doesn't exist
    }

    const entities = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        // Exclude 'mixins' and 'stacks' directories - they must be explicitly included
        if (entry.name === 'mixins' || entry.name === 'stacks') {
          continue;
        }
        const subEntities = await this.loadEntitiesFromDirectory(fullPath, recursive);
        entities.push(...subEntities);
      } else if (entry.isFile() && this._isEntityFile(entry.name)) {
        const entity = await this.loadEntity(fullPath);
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Check if file is an entity file (override in subclasses if needed)
   * @private
   */
  _isEntityFile(filename) {
    return filename.endsWith('.json');
  }

  /**
   * Get entity by name
   * @param {string} name - Entity name
   * @returns {Object|undefined} Entity definition or undefined
   */
  getEntity(name) {
    return this.registry.get(name);
  }

  /**
   * Check if entity exists
   * @param {string} name - Entity name
   * @returns {boolean}
   */
  hasEntity(name) {
    return this.registry.has(name);
  }

  /**
   * Get all loaded entities
   * @returns {Array<Object>}
   */
  getAllEntities() {
    return Array.from(this.registry.values());
  }

  /**
   * Clear all loaded entities
   */
  clear() {
    this.registry.clear();
  }
}
