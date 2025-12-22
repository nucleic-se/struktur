/**
 * CLI Helper Functions
 * Shared utilities for command-line interface operations
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Normalize commander option to array
 * @param {string|string[]|undefined} value - Option value from commander
 * @param {string[]} fallback - Default value if undefined
 * @returns {string[]} Normalized array
 */
export function normalizePathArray(value, fallback = []) {
  if (!value) return fallback;
  return Array.isArray(value) ? value : [value];
}

/**
 * Resolve config file paths relative to config directory
 * @param {Object} config - Configuration object
 * @param {string} configDir - Config file directory
 * @param {string[]} keys - Keys to resolve
 * @returns {Object} Config with resolved paths
 */
export function resolveConfigPaths(config, configDir, keys) {
  for (const key of keys) {
    if (config[key]) {
      const paths = Array.isArray(config[key]) ? config[key] : [config[key]];
      config[key] = paths.map(p => path.resolve(configDir, p));
    }
  }
  return config;
}

/**
 * Auto-discover conventional stack directories
 * @param {string[]} stackDirs - Stack directory paths
 * @param {Object} options - Discovery options
 * @param {boolean} options.includeTemplates - Include templates/ directory
 * @returns {Promise<Object>} Discovered directories
 */
export async function discoverStackDirs(stackDirs, options = {}) {
  const { includeTemplates = true } = options;
  const classDirs = [];
  const instanceDirs = [];
  const aspectDirs = [];
  const templateDirs = [];

  for (const stackDir of stackDirs) {
    const resolvedStackDir = path.resolve(stackDir);
    
    // Define conventional subdirectories
    const conventionalDirs = {
      classes: path.join(resolvedStackDir, 'classes'),
      instances: path.join(resolvedStackDir, 'instances'),
      aspects: path.join(resolvedStackDir, 'aspects')
    };
    
    if (includeTemplates) {
      conventionalDirs.templates = path.join(resolvedStackDir, 'templates');
    }

    // Check which directories exist
    const existingDirs = {};
    for (const [key, dir] of Object.entries(conventionalDirs)) {
      try {
        await fs.access(dir);
        existingDirs[key] = dir;
      } catch {
        // Directory doesn't exist, skip
      }
    }

    // Classes directory is required
    if (!existingDirs.classes) {
      throw new Error(`Stack directory ${stackDir} requires classes/ subdirectory`);
    }

    classDirs.push(existingDirs.classes);
    if (existingDirs.instances) instanceDirs.push(existingDirs.instances);
    if (existingDirs.aspects) aspectDirs.push(existingDirs.aspects);
    if (existingDirs.templates) templateDirs.push(existingDirs.templates);
  }

  // Default instances to classes if not specified
  if (instanceDirs.length === 0) {
    instanceDirs.push(...classDirs);
  }

  return { classDirs, instanceDirs, aspectDirs, templateDirs };
}

/**
 * Validate that directories exist
 * @param {string[]} dirs - Directory paths to validate
 * @param {string} label - Label for error messages
 * @throws {Error} If any directory doesn't exist
 */
export async function validateDirectories(dirs, label) {
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch (error) {
      throw new Error(`${label} directory not found: ${dir}`);
    }
  }
}

/**
 * Handle command errors consistently
 * @param {Error} error - Error to handle
 * @param {Object} options - Command options
 * @param {boolean} options.json - Output as JSON
 */
export function handleCommandError(error, options = {}) {
  if (options.json) {
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
  } else {
    // Use format() method if available (TemplateError classes)
    const message = typeof error.format === 'function' 
      ? error.format() 
      : `Error: ${error.message}`;
    console.error(`\n${message}`);
  }
  process.exit(1);
}
