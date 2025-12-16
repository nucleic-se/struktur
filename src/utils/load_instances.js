/**
 * Instance Loading Utilities
 * Shared logic for loading instances from JSON files
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Load instances from a directory recursively
 * 
 * @param {string} dirPath - Directory path
 * @returns {Promise<{instances: Array, classlessRejects: Array}>} Loaded instances and rejected classless items
 */
export async function loadInstancesFromDir(dirPath) {
  const instances = [];
  const classlessRejects = [];

  async function loadFromDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      // Sort alphabetically for deterministic loading order
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Exclude 'mixins' and 'stacks' directories - they must be explicitly included
          if (entry.name === 'mixins' || entry.name === 'stacks') {
            continue;
          }
          await loadFromDir(fullPath);
        } else if (entry.name.endsWith('.json') && !entry.name.includes('.schema.')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const data = JSON.parse(content);

            if (Array.isArray(data)) {
              // Process each item in array
              for (const item of data) {
                if (item && typeof item === 'object' && item.id) {
                  if (item.class) {
                    instances.push({ ...item, _source_file: fullPath });
                  } else {
                    // Reject classless instances
                    classlessRejects.push({ id: item.id, file: path.basename(fullPath) });
                  }
                }
              }
            } else if (data && typeof data === 'object' && data.id) {
              // Single object with id
              if (data.class) {
                instances.push({ ...data, _source_file: fullPath });
              } else {
                // Reject classless instances
                classlessRejects.push({ id: data.id, file: path.basename(fullPath) });
              }
            }
          } catch (error) {
            // Skip invalid JSON silently
          }
        }
      }
    } catch {
      // Directory doesn't exist or not readable - silently skip
    }
  }

  await loadFromDir(dirPath);
  return { instances, classlessRejects };
}
