/**
 * Engine-Specific Helper Utilities
 * 
 * Shared utilities for engine-specific helpers.
 * 
 * ARCHITECTURE NOTE:
 * Engine helpers like render_file and partial_exists are NOT defined here.
 * They are registered directly by each adapter (HandlebarsAdapter, NunjucksAdapter)
 * since they need direct access to engine internals (partials, loader, compile, etc.).
 * 
 * This module only provides SHARED UTILITIES that both adapters can use,
 * such as path resolution and output queueing logic.
 */

import path from 'path';

/**
 * Resolve output path safely (prevent escaping build directory)
 * 
 * This is a security utility used by render_file and file helpers
 * to ensure output paths don't escape the build directory.
 * 
 * @param {string} templateKey - Template being rendered
 * @param {string} outputPath - Requested output path
 * @param {string} buildDir - Build directory root
 * @param {Object} [log] - Logger
 * @returns {string|null} - Resolved absolute path, or null if invalid
 */
export function resolveOutputPath(templateKey, outputPath, buildDir, log) {
  if (!outputPath || !buildDir) return null;
  
  const requested = path.join(buildDir, outputPath);
  const resolved = path.resolve(requested);
  
  // Security check: ensure resolved path is within build directory
  const buildRoot = path.resolve(buildDir);
  if (!resolved.startsWith(buildRoot)) {
    if (log?.warn) {
      log.warn(`Security: Output path '${outputPath}' in template '${templateKey}' tries to escape build directory`);
    }
    return null;
  }
  
  return resolved;
}

/**
 * Create engine helper context that adapters pass to their helpers
 * 
 * This creates the buildContext object that engine helpers receive.
 * Each adapter calls this and passes it to their engine-specific helpers.
 * 
 * @param {Object} options - Context options
 * @param {string} options.buildDir - Build directory
 * @param {Array} options.outputs - Output queue array
 * @param {Object} options.log - Logger
 * @param {string} options.templateKey - Current template name
 * @param {Object} options.adapter - Adapter instance (for engine access)
 * @returns {Object} - Build context for engine helpers
 */
export function createBuildContext({ buildDir, outputs, log, templateKey, adapter }) {
  return {
    buildDir,
    outputs,
    log,
    templateKey,
    adapter  // Adapter provides access to its engine internals
  };
}
