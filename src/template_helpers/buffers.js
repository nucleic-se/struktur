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
 * Supports optional default value for missing buffers.
 * 
 * Usage (Nunjucks): {{ yield("content") }} or {{ yield("sidebar", "<p>Default</p>") }}
 * Usage (Handlebars): {{{yield "content"}}} or {{{yield "sidebar" "<p>Default</p>"}}}
 * 
 * @param {string} name - Buffer name to yield
 * @param {string} [defaultValue] - Optional default value if buffer doesn't exist
 * @returns {string} Buffer content or default value
 * @throws {BufferNotFoundError} If buffer doesn't exist and no default provided
 */
export function yieldHelper(name, defaultValue) {
  if (!name || typeof name !== 'string') {
    throw new Error('Yield helper requires a buffer name (string)');
  }
  
  if (!this.__context) {
    throw new Error('Buffer system not initialized. Buffers can only be used in templates rendered by Struktur.');
  }
  
  // In Handlebars, the last argument is always the options object
  // Check if we have a real default value (not just the options object)
  const hasDefault = arguments.length > 1 && 
    (typeof defaultValue === 'string' || typeof defaultValue === 'number');
  
  if (!this.__context.hasBuffer(name)) {
    if (hasDefault) {
      return defaultValue || '';
    }
    throw new BufferNotFoundError(
      name,
      'current template',
      this.__context.getAvailableBuffers()
    );
  }
  return this.__context.readBuffer(name);
}

/**
 * Buffer exists helper - check if buffer has been written
 * 
 * Usage (Nunjucks): {% if buffer_exists("sidebar") %}...{% endif %}
 * Usage (Handlebars): {{#if (buffer_exists "sidebar")}}...{{/if}}
 * 
 * @param {string} name - Buffer name to check
 * @returns {boolean} True if buffer exists
 */
export function bufferExistsHelper(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  if (this.__context) {
    return this.__context.hasBuffer(name);
  }
  return false;
}

/**
 * Extends helper - declare layout to extend
 * 
 * Sets the layout that this template extends. The layout will be rendered
 * after all buffers are collected, with access to all buffer content.
 * 
 * Usage (Nunjucks): {{ extends("layouts/base") }}
 * Usage (Handlebars): {{extends "layouts/base"}}
 * 
 * @param {string} layoutName - Name of layout to extend
 * @returns {string} Empty string (no output)
 * @throws {Error} If layout already extended or context not initialized
 */
export function extendsHelper(layoutName) {
  if (!layoutName || typeof layoutName !== 'string') {
    throw new Error('Extends helper requires a layout name (string)');
  }
  
  if (!this.__context) {
    throw new Error('Buffer system not initialized. Extends can only be used in templates rendered by Struktur.');
  }
  
  // Check if THIS specific context (not prototype chain) already has extendedLayout
  if (this.__context.hasOwnProperty('extendedLayout')) {
    throw new Error(
      `Layout already extended: ${this.__context.extendedLayout}\n` +
      `Cannot extend multiple layouts. A template can only extend one layout.`
    );
  }
  
  this.__context.extendedLayout = layoutName;
  return ''; // No output
}

/**
 * Register buffer helpers with adapter
 * 
 * @param {TemplateAdapter} adapter - Template adapter instance
 */
export function registerBufferHelpers(adapter) {
  adapter.registerHelper('buffer', bufferHelper);
  adapter.registerHelper('yield', yieldHelper);
  adapter.registerHelper('buffer_exists', bufferExistsHelper);
  adapter.registerHelper('extends', extendsHelper);
}

