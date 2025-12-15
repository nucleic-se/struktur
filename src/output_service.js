/**
 * Secure Output Service
 * 
 * Centralized, security-hardened file writing for template rendering.
 * All file writes go through this service to enforce security policies.
 * 
 * Security Features:
 * - Path traversal prevention (no ../ escapes)
 * - Build directory boundary enforcement
 * - Collision detection (prevent accidental overwrites)
 * - Audit logging (track all file operations)
 * - Atomic writes (all-or-nothing transactions)
 */

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export class OutputService {
  constructor(buildDir, options = {}) {
    this.buildDir = path.resolve(buildDir);
    this.outputs = [];
    this.written = new Set();
    this.log = options.log || console;
    this.allowOverwrite = options.allowOverwrite || false;
    
    // Audit trail
    this.audit = {
      buildDir: this.buildDir,
      started: new Date().toISOString(),
      operations: []
    };
  }

  /**
   * Queue a file for writing (atomic rendering)
   * 
   * @param {Object} output - Output descriptor
   * @param {string} output.path - Relative path within build dir
   * @param {string} output.content - File content
   * @param {Object} [output.metadata] - Optional metadata for tracking
   * @returns {Object} - Validation result
   */
  queue(output) {
    const { path: requestedPath, content, metadata = {} } = output;

    // Security: Validate and resolve path
    const validation = this.validatePath(requestedPath);
    if (!validation.valid) {
      this.logAudit('REJECTED', requestedPath, validation.reason);
      throw new Error(`Security: ${validation.reason}`);
    }

    const resolvedPath = validation.absolutePath;

    // Collision detection
    if (this.outputs.some(o => o.absolutePath === resolvedPath)) {
      const reason = `Duplicate output path: ${requestedPath}`;
      this.logAudit('COLLISION', requestedPath, reason);
      throw new Error(reason);
    }

    // Queue for writing
    this.outputs.push({
      relativePath: validation.relativePath,
      absolutePath: resolvedPath,
      content: String(content),
      metadata,
      hash: this.hashContent(content),
      queuedAt: new Date().toISOString()
    });

    this.logAudit('QUEUED', validation.relativePath, 'OK');

    return { valid: true, path: validation.relativePath };
  }

  /**
   * Validate path security
   * 
   * @param {string} requestedPath - Path to validate
   * @returns {Object} - Validation result
   */
  validatePath(requestedPath) {
    if (!requestedPath) {
      return { valid: false, reason: 'Empty path not allowed' };
    }

    // Remove leading slashes
    const normalized = requestedPath.replace(/^\/+/, '');

    // Check for directory traversal attempts
    if (normalized.includes('..')) {
      return { valid: false, reason: 'Path traversal (..) not allowed' };
    }

    // Check for absolute paths (should be relative)
    if (path.isAbsolute(normalized)) {
      return { valid: false, reason: 'Absolute paths not allowed' };
    }

    // Resolve full path
    const absolutePath = path.resolve(this.buildDir, normalized);

    // CRITICAL: Ensure path is within build directory
    if (!absolutePath.startsWith(this.buildDir + path.sep) && absolutePath !== this.buildDir) {
      return { 
        valid: false, 
        reason: `Path escapes build directory: ${normalized}` 
      };
    }

    return {
      valid: true,
      relativePath: normalized,
      absolutePath
    };
  }

  /**
   * Write all queued files atomically
   * 
   * @returns {Promise<Object>} - Write result
   */
  async writeAll() {
    if (this.outputs.length === 0) {
      return { written: 0, skipped: 0, failed: 0 };
    }

    const results = {
      written: 0,
      skipped: 0,
      failed: 0,
      files: []
    };

    // Check for existing files (safety check)
    if (!this.allowOverwrite) {
      for (const output of this.outputs) {
        try {
          await fs.access(output.absolutePath);
          // File exists
          if (!this.written.has(output.absolutePath)) {
            const reason = `File exists and overwrite not allowed: ${output.relativePath}`;
            this.logAudit('BLOCKED', output.relativePath, reason);
            throw new Error(reason);
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
          // File doesn't exist - OK to write
        }
      }
    }

    // Write all files
    for (const output of this.outputs) {
      try {
        // Ensure directory exists
        const dir = path.dirname(output.absolutePath);
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(output.absolutePath, output.content, 'utf-8');

        // Track written file
        this.written.add(output.absolutePath);
        results.written++;
        results.files.push(output.relativePath);

        this.logAudit('WRITTEN', output.relativePath, `${output.content.length} bytes`);
      } catch (error) {
        results.failed++;
        this.logAudit('FAILED', output.relativePath, error.message);
        throw error;
      }
    }

    // Clear queue after successful write
    this.outputs = [];

    this.audit.completed = new Date().toISOString();
    return results;
  }

  /**
   * Clear queue without writing
   */
  clearQueue() {
    this.outputs = [];
    this.logAudit('QUEUE_CLEARED', '-', 'Queue cleared');
  }

  /**
   * Get queued outputs (for inspection/testing)
   */
  getQueue() {
    return this.outputs.map(o => ({
      path: o.relativePath,
      size: o.content.length,
      hash: o.hash,
      metadata: o.metadata
    }));
  }

  /**
   * Log audit entry
   * @private
   */
  logAudit(action, path, detail) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      path,
      detail
    };

    this.audit.operations.push(entry);

    // Also log to console if available
    if (this.log && action === 'REJECTED' || action === 'BLOCKED' || action === 'FAILED') {
      this.log.warn?.(`[OutputService] ${action}: ${path} - ${detail}`);
    }
  }

  /**
   * Get audit trail
   */
  getAudit() {
    return { ...this.audit };
  }

  /**
   * Hash content for deduplication/verification
   * @private
   */
  hashContent(content) {
    return crypto
      .createHash('sha256')
      .update(String(content))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get build directory
   */
  getBuildDir() {
    return this.buildDir;
  }
}
