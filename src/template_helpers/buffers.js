import { BufferNotFoundError } from '../template_errors.js';

/**
 * Buffer Helpers - Named buffer management for template inheritance
 * 
 * Enables extends/yields pattern:
 * - Content templates write to named buffers
 * - Layout templates yield buffer content
 * - Supports multi-template → single file composition
 */

/**
 * Buffer helper - write to named buffer
 * 
 * Usage (Nunjucks): {% buffer name="content", destination="/index.html" %}...{% endbuffer %}
 * Usage (Handlebars): {{#buffer name="content" destination="/index.html"}}...{{/buffer}}
 * 
 * @param {Object} options - Helper options
 * @param {Object} options.hash - Named parameters (Handlebars)
 * @param {string} options.name - Buffer name (Nunjucks)
 * @param {string} options.destination - File destination (Nunjucks)
 * @param {string} options.mode - Write mode: replace, append, prepend
 * @param {Function} options.fn - Block content function (Handlebars)
 * @param {string} options.body - Block content (Nunjucks)
 * @returns {string} Empty string (buffers don't output directly)
 */
export function bufferHelper(options) {
  // Handle both Nunjucks (kwargs) and Handlebars (hash) syntax
  const name = options.hash?.name || options.name || 'default';
  const destination = options.hash?.destination || options.destination || null;
  const mode = options.hash?.mode || options.mode || 'replace';
  
  const content = typeof options.fn === 'function' 
    ? options.fn(this)  // Handlebars block helper
    : options.body;      // Nunjucks block content
  
  // Access render context from template context
  if (this.__context) {
    this.__context.writeBuffer(name, content, mode, destination);
  }
  
  return '';  // Buffer doesn't output directly
}

/**
 * Yield helper - read from buffer
 * 
 * Usage (Nunjucks): {{ yield("content") }}
 * Usage (Handlebars): {{{yield "content"}}}
 * 
 * @param {string} name - Buffer name to yield
 * @returns {string} Buffer content
 * @throws {BufferNotFoundError} If buffer doesn't exist
 */
export function yieldHelper(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Yield helper requires a buffer name (string)');
  }
  
  if (this.__context) {
    if (!this.__context.hasBuffer(name)) {
      throw new BufferNotFoundError(
        name,
        'current template',
        this.__context.getAvailableBuffers()
      );
    }
    return this.__context.readBuffer(name);
  }
  return '';
}

/**
 * Register buffer helpers with adapter
 * 
 * @param {TemplateAdapter} adapter - Template adapter instance
 */
export function registerBufferHelpers(adapter) {
  adapter.registerHelper('buffer', bufferHelper);
  adapter.registerHelper('yield', yieldHelper);
}

