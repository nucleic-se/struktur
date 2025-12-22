/**
 * Atomic File Write Utility
 * 
 * Implements write-to-temp + rename pattern for atomic file writes.
 * Prevents corruption if process crashes mid-write.
 * 
 * NOTE: If cross-platform robustness becomes important, swap this
 * implementation for write-file-atomic library without changing call sites.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Atomically write file using write-to-temp + rename pattern
 * 
 * @param {string} filePath - Target file path
 * @param {string|Buffer} data - File content
 * @param {string|Object} options - Encoding string or options object (default: 'utf-8')
 * @returns {Promise<void>}
 * 
 * @example
 * await atomicWrite('/path/to/file.json', JSON.stringify(data), 'utf-8');
 * 
 * // To swap for write-file-atomic later:
 * // import writeFileAtomic from 'write-file-atomic';
 * // export async function atomicWrite(filePath, data, options) {
 * //   return writeFileAtomic(filePath, data, options);
 * // }
 */
export async function atomicWrite(filePath, data, options = 'utf-8') {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  
  // Create temp file in same directory (ensures same filesystem for atomic rename)
  const tmpSuffix = crypto.randomBytes(6).toString('hex');
  const tmpPath = path.join(dir, `.${basename}.tmp.${tmpSuffix}`);
  
  try {
    // Write to temp file
    await fs.writeFile(tmpPath, data, options);
    
    // Atomic rename (POSIX guarantee: single syscall, no partial state)
    await fs.rename(tmpPath, filePath);
    
  } catch (error) {
    // Cleanup temp file on error (best effort)
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    
    // Re-throw original error with context
    error.message = `Atomic write failed for ${filePath}: ${error.message}`;
    throw error;
  }
}
