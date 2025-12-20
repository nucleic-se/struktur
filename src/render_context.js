import { Buffer } from './buffer.js';

/**
 * Render Context - Manages canonical data, buffers, and file outputs
 * 
 * Provides:
 * - Canonical data access (instances, metadata)
 * - Named buffer management (for extends/yields)
 * - File output accumulation
 * - Template context generation
 */
export class RenderContext {
  /**
   * @param {Object} canonical - Canonical data (instances, collections)
   * @param {string} buildDir - Build output directory
   * @param {Object} metadata - Optional build metadata
   */
  constructor(canonical, buildDir, metadata = {}) {
    this.canonical = canonical;
    this.buildDir = buildDir;
    this.metadata = metadata;
    this.buffers = new Map();  // name → Buffer
    this.fileOutputs = new Map();  // destination → content
  }
  
  /**
   * Write to a named buffer (creates buffer if needed)
   * @param {string} name - Buffer name
   * @param {string} content - Content to write
   * @param {'replace'|'append'|'prepend'} mode - Write mode
   * @param {string|null} destination - Optional file destination
   */
  writeBuffer(name, content, mode = 'replace', destination = null) {
    if (!name || typeof name !== 'string') {
      throw new Error('Buffer name must be a non-empty string');
    }
    
    if (!this.buffers.has(name)) {
      this.buffers.set(name, new Buffer(name));
    }
    
    const buffer = this.buffers.get(name);
    buffer.write(String(content), mode);
    
    if (destination !== null) {
      buffer.setDestination(destination);
    }
  }
  
  /**
   * Read from a named buffer (for yield)
   * @param {string} name - Buffer name
   * @returns {string} Buffer content or empty string if not found
   */
  readBuffer(name) {
    const buffer = this.buffers.get(name);
    return buffer ? buffer.read() : '';
  }
  
  /**
   * Check if buffer exists
   * @param {string} name - Buffer name
   * @returns {boolean}
   */
  hasBuffer(name) {
    return this.buffers.has(name);
  }
  
  /**
   * Get list of available buffer names
   * @returns {string[]} Array of buffer names
   */
  getAvailableBuffers() {
    return Array.from(this.buffers.keys());
  }
  
  /**
   * Add file output (or append to existing)
   * @param {string} destination - File path relative to build directory
   * @param {string} content - File content
   * @param {'replace'|'append'} mode - Write mode
   */
  addOutput(destination, content, mode = 'replace') {
    if (!destination || typeof destination !== 'string') {
      throw new Error('Output destination must be a non-empty string');
    }
    
    if (mode === 'append' && this.fileOutputs.has(destination)) {
      this.fileOutputs.set(destination, 
        this.fileOutputs.get(destination) + content);
    } else {
      this.fileOutputs.set(destination, content);
    }
  }
  
  /**
   * Get all file outputs
   * @returns {Array<{destination: string, content: string}>}
   */
  getFileOutputs() {
    return Array.from(this.fileOutputs.entries()).map(([dest, content]) => ({
      destination: dest,
      content
    }));
  }
  
  /**
   * Get template context object (what gets passed to templates)
   * Includes canonical data, metadata, and internal __context reference
   * @returns {Object} Template context
   */
  getTemplateContext() {
    return {
      ...this.canonical,
      metadata: this.metadata,
      __context: this  // Internal: for buffer/yield helpers
    };
  }
}
