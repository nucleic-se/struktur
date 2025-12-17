/**
 * Build manifest utilities for collision detection
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../../package.json');

/**
 * Generate a deterministic hash from build configuration
 */
export function generateBuildHash(config) {
  const { classDirs, aspectDirs, instanceDirs, templateDirs } = config;
  
  // Create sorted, normalized config for consistent hashing
  const normalized = {
    classDirs: (classDirs || []).map(d => path.resolve(d)).sort(),
    aspectDirs: (aspectDirs || []).map(d => path.resolve(d)).sort(),
    instanceDirs: (instanceDirs || []).map(d => path.resolve(d)).sort(),
    templateDirs: (templateDirs || []).map(d => path.resolve(d)).sort()
  };
  
  const configString = JSON.stringify(normalized);
  return crypto.createHash('md5').update(configString).digest('hex').slice(0, 8);
}

/**
 * Read existing build manifest
 */
export async function readManifest(buildDir) {
  try {
    const manifestPath = path.join(buildDir, '.struktur-manifest.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write build manifest
 */
export async function writeManifest(buildDir, config) {
  const manifest = {
    version: PACKAGE_VERSION,
    timestamp: new Date().toISOString(),
    hash: generateBuildHash(config),
    sources: {
      classDirs: (config.classDirs || []).map(d => path.resolve(d)),
      aspectDirs: (config.aspectDirs || []).map(d => path.resolve(d)),
      instanceDirs: (config.instanceDirs || []).map(d => path.resolve(d)),
      templateDirs: (config.templateDirs || []).map(d => path.resolve(d))
    }
  };
  
  const manifestPath = path.join(buildDir, '.struktur-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  
  return manifest;
}

/**
 * Check for build collision (same buildDir, different inputs)
 */
export async function checkCollision(buildDir, config, logger) {
  const existingManifest = await readManifest(buildDir);
  
  if (!existingManifest) {
    return { collision: false };
  }
  
  const newHash = generateBuildHash(config);
  
  if (existingManifest.hash !== newHash) {
    const warning = `Build directory collision detected:
  Directory: ${buildDir}
  Previous build: ${existingManifest.timestamp}
  Previous hash: ${existingManifest.hash}
  Current hash: ${newHash}
  
  Input directories have changed. Previous artifacts will be overwritten.
  Consider using --deterministic flag for hash-based build directories.`;
    
    if (logger) {
      logger.warn(warning);
    }
    
    return {
      collision: true,
      existingManifest,
      newHash,
      warning
    };
  }
  
  return { collision: false, rebuild: true };
}

/**
 * Generate deterministic build directory name
 */
export function generateDeterministicBuildDir(baseBuildDir, config) {
  const hash = generateBuildHash(config);
  return path.join(baseBuildDir, `build-${hash}`);
}
