/**
 * AspectLoader - Load aspect definitions without modification
 *
 * Key principle: Load raw, don't transform
 */

import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';

function normalizeDirEntry(dirEntry) {
  if (dirEntry && typeof dirEntry === 'object' && dirEntry.path) {
    return {
      path: dirEntry.path,
      explicit: dirEntry.explicit === true
    };
  }
  return {
    path: dirEntry,
    explicit: true
  };
}

export class AspectLoader {
  constructor() {
    /** @type {Map<string, AspectDefinition>} */
    this.aspects = new Map();
  }

  /**
   * Load aspect definition from file
   * @param {string} filePath - Path to aspect JSON file
   * @returns {Promise<AspectDefinition>}
   */
  async loadAspect(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const aspect = JSON.parse(content);

    // Validate required fields (check aspect field first)
    if (!aspect.$aspect) {
      throw new Error(`Aspect definition missing '$aspect' field: ${filePath}`);
    }

    if (!aspect.$class) {
      throw new Error(`Aspect definition missing '$class' field: ${filePath}`);
    }

    if (aspect.$class !== aspect.$aspect) {
      throw new Error(
        `Aspect definition '$class' must match '$aspect' (${filePath}): ` +
        `'$class'=${aspect.$class}, '$aspect'=${aspect.$aspect}`
      );
    }

    if (!aspect.$schema) {
      throw new Error(`Aspect definition missing '$schema' field: ${filePath}`);
    }

    // Meta-validate schema against JSON Schema draft-07 (security: fail fast)
    try {
      const ajv = new Ajv({ strict: true, strictRequired: true, strictTypes: true, validateSchema: true, validateFormats: false });
      ajv.compile(aspect.$schema);
    } catch (error) {
      throw new Error(
        `Invalid JSON Schema in aspect '${aspect.$aspect}' (${filePath}): ${error.message}`
      );
    }

    // Check for duplicate aspect names
    if (this.aspects.has(aspect.$aspect)) {

      throw new Error(
        `Duplicate aspect name '${aspect.$aspect}' found in ${filePath}. ` +
        'Already loaded from previous location.'
      );
    }

    // Store in registry
    this.aspects.set(aspect.$aspect, aspect);

    return aspect;
  }

  /**
   * Load all aspects from directory (recursive)
   * @param {string} dirPath - Path to aspects directory
   * @param {Object} [options] - Load options
   * @param {boolean} [options.recursive=true] - Load recursively
   * @returns {Promise<Array<AspectDefinition>>}
   */
  async loadAspectsFromDirectory(dirPath, options = {}) {
    const { recursive = true } = options;
    const aspects = [];
    const dir = normalizeDirEntry(dirPath);
    const self = this;

    async function loadFromDir(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        // Sort alphabetically for deterministic loading order
        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && recursive) {
            // Recurse into subdirectories
            await loadFromDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.class.json')) {
            try {
              const aspect = await self.loadAspect(fullPath);
              aspects.push(aspect);
            } catch (error) {
              throw new Error(`Failed to load aspect ${fullPath}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        throw error;
      }
    }

    try {
      await loadFromDir(dir.path);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        if (dir.explicit) {
          throw new Error(
            `Aspect directory not found: ${dir.path}\n` +
            `  This directory was explicitly configured via CLI or config file\n` +
            `  Hint: Check path spelling or create the directory`
          );
        }
        return aspects;
      }
      throw error;
    }
    return aspects;
  }

  /**
   * Get aspect definition by name
   * @param {string} aspectName - Aspect name
   * @returns {AspectDefinition|undefined}
   */
  getAspect(aspectName) {
    return this.aspects.get(aspectName);
  }

  /**
   * Check if aspect exists
   * @param {string} aspectName - Aspect name
   * @returns {boolean}
   */
  hasAspect(aspectName) {
    return this.aspects.has(aspectName);
  }

  /**
   * Get all loaded aspects
   * @returns {Array<AspectDefinition>}
   */
  getAllAspects() {
    return Array.from(this.aspects.values());
  }

  /**
   * Clear all loaded aspects
   */
  clear() {
    this.aspects.clear();
  }
}
