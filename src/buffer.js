/**
 * Buffer - Named content buffer with optional file destination
 * 
 * Supports three write modes:
 * - replace: Overwrites current content (default)
 * - append: Adds to end of current content
 * - prepend: Adds to beginning of current content
 */
export class Buffer {
  /**
   * @param {string} name - Buffer name identifier
   */
  constructor(name) {
    this.name = name;
    this.content = '';
    this.destination = null;  // File path or null
  }
  
  /**
   * Write content to buffer
   * @param {string} content - Content to write
   * @param {'replace'|'append'|'prepend'} mode - Write mode
   * @throws {Error} If mode is invalid
   */
  write(content, mode = 'replace') {
    const validModes = ['replace', 'append', 'prepend'];
    if (!validModes.includes(mode)) {
      throw new Error(`Unknown buffer write mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
    }
    
    switch (mode) {
      case 'replace':
        this.content = content;
        break;
      case 'append':
        this.content += content;
        break;
      case 'prepend':
        this.content = content + this.content;
        break;
    }
  }
  
  /**
   * Read buffer content
   * @returns {string} Current buffer content
   */
  read() {
    return this.content;
  }
  
  /**
   * Check if buffer is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.content.length === 0;
  }
  
  /**
   * Set file destination for buffer output
   * @param {string} path - File path relative to build directory
   */
  setDestination(path) {
    this.destination = path;
  }
  
  /**
   * Check if this buffer should output to a file
   * @returns {boolean}
   */
  isFileOutput() {
    return this.destination !== null;
  }
  
  /**
   * Clear buffer content
   */
  clear() {
    this.content = '';
  }
}
