/**
 * Instance Loader
 * 
 * Loads entity instances from JSON files in a directory tree.
 * 
 * ## Responsibility
 * 
 * This loader handles **file system discovery** and **JSON parsing** of instance data.
 * It recursively scans directories, loads JSON files, and returns raw instance objects.
 * 
 * Key behaviors:
 * - Recursive directory traversal (excludes 'mixins' and 'stacks')
 * - Both single-object and array JSON formats supported
 * - Alphabetical loading order for determinism
 * - Classless instance rejection (requires '$class' field)
 * - Invalid JSON logged as warnings (helps users debug)
 * - Adds `$source_file` metadata to each instance
 * 
 * ## Comparison with Other Loaders
 * 
 * | Loader                    | Purpose                                  | Location        | Phase       |
 * |---------------------------|------------------------------------------|-----------------|-------------|
 * | **instance_loader.js**    | Load instances from JSON files           | /src/           | Build       |
 * | template_loader.js        | Load & parse template files              | /src/           | Template    |
 * | source/file_source.js     | Load schemas from file system            | /src/source/    | Discovery   |
 * | canonical.js              | Load schemas & resolve inheritance       | /src/           | Schema      |
 * | class_resolver.js         | Resolve class field defaults             | /src/           | Schema      |
 * 
 * ## Design Notes
 * 
 * This loader is intentionally **simple and focused**:
 * - Does NOT validate instances (validation happens later in build pipeline)
 * - Does NOT resolve inheritance (canonical.js handles that)
 * - Does NOT merge defaults (instance_merger.js handles that)
 * - Does NOT render templates (TemplateEngine handles that)
 * 
 * The separation keeps each component single-purpose and testable.
 * 
 * ## Usage
 * 
 * ```javascript
 * import { loadInstancesFromDir } from './instance_loader.js';
 * 
 * const { instances, classlessRejects } = await loadInstancesFromDir(
 *   '/path/to/instances',
 *   { logger: console }
 * );
 * 
 * // instances: Array of valid instance objects (have '$class' field)
 * // classlessRejects: Array of {id, file} for instances missing '$class'
 * ```
 * 
 * @module instance_loader
 */

import fs from 'fs/promises';
import path from 'path';

function validateRenderFormat(renderValue, instanceId, filePath) {
  if (!Array.isArray(renderValue)) {
    throw new Error(
      `Instance ${instanceId}: $render must be an array of {template, output} objects. ` +
      `File: ${filePath}`
    );
  }

  for (let i = 0; i < renderValue.length; i++) {
    const task = renderValue[i];
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      throw new Error(
        `Instance ${instanceId}: $render[${i}] must be an object with "template" and "output". ` +
        `File: ${filePath}`
      );
    }

    if (typeof task.template !== 'string' || task.template.trim() === '') {
      throw new Error(
        `Instance ${instanceId}: $render[${i}].template must be a non-empty string. ` +
        `File: ${filePath}`
      );
    }

    if (typeof task.output !== 'string' || task.output.trim() === '') {
      throw new Error(
        `Instance ${instanceId}: $render[${i}].output must be a non-empty string. ` +
        `File: ${filePath}`
      );
    }

    const extraKeys = Object.keys(task).filter(key => key !== 'template' && key !== 'output');
    if (extraKeys.length > 0) {
      throw new Error(
        `Instance ${instanceId}: $render[${i}] has unexpected keys: ${extraKeys.join(', ')}. ` +
        `Only "template" and "output" are allowed. File: ${filePath}`
      );
    }
  }
}

/**
 * Load instances from a directory recursively
 * 
 * Scans the directory tree for JSON files (excluding .class.json files),
 * parses them, and returns valid instances with `$class` and `$id` fields.
 * 
 * ## Directory Exclusions
 * 
 * The following directories are automatically excluded:
 * - `mixins/` - Must be explicitly loaded if needed
 * - `stacks/` - Must be explicitly loaded if needed
 * 
 * This prevents accidental inclusion of shared components that should be
 * explicitly referenced by instances.
 * 
 * ## JSON Format Support
 * 
 * Both formats are supported:
 * 
 * **Single object:**
 * ```json
 * {
 *   "$id": "my-server",
 *   "$class": "server",
 *   "name": "Production Server"
 * }
 * ```
 * 
 * **Array of objects:**
 * ```json
 * [
 *   {"$id": "server-1", "$class": "server", "name": "Server 1"},
 *   {"$id": "server-2", "$class": "server", "name": "Server 2"}
 * ]
 * ```
 * 
 * ## Instance Requirements
 * 
 * To be loaded successfully, instances must have:
 * - `$id` field (string identifier)
 * - `$class` field (references a class definition)
 * 
 * Instances missing either field are rejected:
 * - No `$id`: Silently skipped (not a valid instance)
 * - No `$class`: Added to `classlessRejects` array for error reporting
 * 
 * ## Error Handling
 * 
 * - **Invalid JSON**: Logged as warning (if logger provided), file skipped
 * - **Missing directory**: Silently handled (returns empty arrays)
 * - **Unreadable files**: Silently skipped
 * 
 * ## Loading Order
 * 
 * Files are processed alphabetically within each directory level.
 * This ensures deterministic loading order across runs.
 * 
 * @param {string} dirPath - Absolute path to directory containing instance JSON files
 * @param {Object} [options] - Loading options
 * @param {Object} [options.logger] - Logger with warn() method for invalid JSON errors
 * 
 * @returns {Promise<{instances: Array<Object>, classlessRejects: Array<{id: string, file: string}>}>}
 *   Result object containing:
 *   - `instances`: Array of valid instances (with `$source_file` metadata)
 *   - `classlessRejects`: Array of rejected instances (have `$id` but no `$class`)
 * 
 * @example
 * // Load all instances from a directory
 * const { instances, classlessRejects } = await loadInstancesFromDir(
 *   '/stack/instances',
 *   { logger: console }
 * );
 * 
 * // Check for classless instances
 * if (classlessRejects.length > 0) {
 *   console.error('Found instances without $class field:', classlessRejects);
 * }
 * 
 * // Each instance has $source_file metadata
 * instances.forEach(inst => {
 *   console.log(`${inst.$id} from ${inst.$source_file}`);
 * });
 */
export async function loadInstancesFromDir(dirPath, options = {}) {
  const { logger } = options;
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
        } else if (entry.name.endsWith('.json') && !entry.name.includes('.schema.') && !entry.name.includes('.class.')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const data = JSON.parse(content);

            if (Array.isArray(data)) {
              // Reject array instance files
              if (logger?.warn) {
                logger.warn(
                  `Array instance files are not supported: ${fullPath}\n\n` +
                  'Each instance must be in its own file.\n' +
                  'If you have multiple instances, create multiple files:\n' +
                  '  instances/server1.json\n' +
                  '  instances/server2.json'
                );
              }
              continue;
            }
            
            if (data && typeof data === 'object') {
              const legacyFields = ['id', 'class', 'render', 'aspects'].filter(field => field in data);
              if (legacyFields.length > 0) {
                throw new Error(
                  `Instance uses legacy fields (${legacyFields.join(', ')}). ` +
                  `Use $id/$class/$render/$aspects. File: ${fullPath}`
                );
              }

              if (data.$id) {
                // Single object with $id
                if (!data.$class) {
                  // Reject classless instances
                  classlessRejects.push({ id: data.$id, file: path.basename(fullPath) });
                } else {
                  if (data.$render !== undefined) {
                    validateRenderFormat(data.$render, data.$id, fullPath);
                  }
                  instances.push({ ...data, $source_file: fullPath });
                }
              }
            }
          } catch (error) {
            if (error instanceof SyntaxError) {
              // Log warning for invalid JSON (helps users debug typos)
              if (logger?.warn) {
                logger.warn(`Skipping ${fullPath}: Invalid JSON - ${error.message}`);
              }
            } else {
              throw error;
            }
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or not readable - silently skip
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        return;
      }
      throw error;
    }
  }

  await loadFromDir(dirPath);
  return { instances, classlessRejects };
}
