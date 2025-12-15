/**
 * Logger utility for Struktur v2
 * Provides structured logging with support for quiet/silent modes
 */

export class Logger {
  constructor(options = {}) {
    this.quiet = options.quiet || false;
    this.silent = options.silent || false;
    this.warnings = [];
    this.errors = [];
  }

  /**
   * Log an info message
   */
  log(message) {
    if (!this.quiet && !this.silent) {
      console.log(message);
    }
  }

  /**
   * Log a warning message
   */
  warn(message, metadata = {}) {
    this.warnings.push({ message, ...metadata, timestamp: new Date().toISOString() });
    if (!this.silent) {
      console.warn(message);
    }
  }

  /**
   * Log an error message
   */
  error(message, metadata = {}) {
    this.errors.push({ message, ...metadata, timestamp: new Date().toISOString() });
    if (!this.silent) {
      console.error(message);
    }
  }

  /**
   * Get all warnings
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * Get all errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Check if any errors occurred
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Check if any warnings occurred
   */
  hasWarnings() {
    return this.warnings.length > 0;
  }

  /**
   * Clear all warnings and errors
   */
  clear() {
    this.warnings = [];
    this.errors = [];
  }
}

/**
 * Create a logger instance
 */
export function createLogger(options = {}) {
  return new Logger(options);
}
