/**
 * Template collision detection utilities
 * 
 * Detects when the same template key appears in multiple template directories.
 * Later directories override earlier ones in search paths.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Recursively discover all template files in a directory
 * @param {string} baseDir - Base directory being scanned
 * @param {string} currentDir - Current directory in recursion
 * @param {string[]} files - Accumulated file list
 * @returns {Promise<string[]>} - Relative paths from baseDir
 */
async function discoverTemplatesRecursive(baseDir, currentDir, files = []) {
  try {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, hidden dirs
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        await discoverTemplatesRecursive(baseDir, fullPath, files);
      } else if (entry.isFile()) {
        // Include ALL files (extension-agnostic)
        const relativePath = path.relative(baseDir, fullPath);
        const normalizedPath = relativePath.replace(/\\/g, '/');
        files.push(normalizedPath);
      }
    }
    
    return files;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return files;
    }
    throw error;
  }
}

/**
 * Scan template directories and detect collisions
 * @param {string[]} templateDirs - Array of template directories
 * @returns {Promise<Object>} - Collision report
 */
export async function detectTemplateCollisions(templateDirs) {
  const templateMap = new Map(); // key => [{dir, fullPath}]
  
  for (const templateDir of templateDirs) {
    const templates = await discoverTemplatesRecursive(templateDir, templateDir);
    
    for (const templatePath of templates) {
      const key = templatePath; // Normalized relative path is the key
      
      if (!templateMap.has(key)) {
        templateMap.set(key, []);
      }
      
      templateMap.get(key).push({
        dir: templateDir,
        fullPath: path.join(templateDir, templatePath),
        relativePath: templatePath
      });
    }
  }
  
  // Find collisions (templates appearing in multiple directories)
  const collisions = [];
  const uniqueTemplates = [];
  
  for (const [key, sources] of templateMap.entries()) {
    if (sources.length > 1) {
      collisions.push({
        templateKey: key,
        sources: sources.map(s => s.dir),
        winner: sources[0].dir, // First one wins in search path
        fullPaths: sources.map(s => s.fullPath)
      });
    } else {
      uniqueTemplates.push({
        templateKey: key,
        source: sources[0].dir
      });
    }
  }
  
  return {
    totalTemplates: templateMap.size,
    uniqueTemplates: uniqueTemplates.length,
    collisionCount: collisions.length,
    collisions
  };
}

/**
 * Format collision report for logging
 * @param {Object} report - Collision report from detectTemplateCollisions
 * @param {Object} options - Formatting options
 * @returns {string[]} - Array of log lines
 */
export function formatCollisionReport(report, options = {}) {
  const { verbose = false } = options;
  const lines = [];
  
  if (report.collisionCount === 0) {
    if (verbose) {
      lines.push(`  ✓ ${report.totalTemplates} unique templates discovered (no collisions)`);
    }
    return lines;
  }
  
  lines.push(`  ⚠ ${report.collisionCount} template collision(s) detected:`);
  lines.push('');
  
  for (const collision of report.collisions) {
    lines.push(`  Template: ${collision.templateKey}`);
    lines.push(`  Sources:`);
    
    for (let i = 0; i < collision.sources.length; i++) {
      const source = collision.sources[i];
      const isWinner = i === 0; // First directory wins in search path order
      const marker = isWinner ? '→ USED' : '  overridden';
      lines.push(`    ${marker}: ${source}`);
    }
    lines.push('');
  }
  
  lines.push(`  Note: Later directories override earlier ones in search path order.`);
  lines.push(`        Collisions fail by default. Use --allow-template-collisions to permit.`);
  
  return lines;
}
