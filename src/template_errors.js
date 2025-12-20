/**
 * Template Error Hierarchy
 * 
 * Structured error classes for template system with phase context,
 * smart suggestions, and consistent formatting.
 * 
 * HIERARCHY:
 * 
 * TemplateError (base)
 *   ├─ TemplateNotFoundError   - Template file doesn't exist
 *   ├─ TemplateSyntaxError     - Parse error (malformed template)
 *   ├─ TemplateRenderError     - Runtime error (undefined var, bad logic)
 *   ├─ BufferNotFoundError     - yield() called for non-existent buffer
 *   └─ CircularExtendsError    - Infinite {% extends %} loop (planned)
 * 
 * USAGE:
 * 
 * All errors include:
 * - Phase context (Template Loading, Template Rendering)
 * - Structured formatting via format() method
 * - Smart suggestions based on error type
 * - File paths and line numbers when available
 * 
 * WHEN TO USE WHICH ERROR:
 * 
 * | Error Type              | When                           | Phase              |
 * |-------------------------|--------------------------------|--------------------|
 * | TemplateNotFoundError   | File doesn't exist             | Template Loading   |
 * | TemplateSyntaxError     | Parse/compile fails            | Template Parsing   |
 * | TemplateRenderError     | Undefined var, logic error     | Template Rendering |
 * | BufferNotFoundError     | yield() for missing buffer     | Buffer Resolution  |
 * | CircularExtendsError    | Infinite extends chain         | Template Inheritance |
 * 
 * ERROR DISPLAY FORMAT:
 * 
 * All errors use consistent format:
 * ```
 * 📋 Phase: Template Loading
 * ❌ Template not found: index.html
 * 
 *    Searched in:
 *      • /path/to/templates/
 *      • /path/to/templates/partials/
 * 
 *    💡 Suggestions:
 *      • Check template name spelling
 *      • Verify template directory path
 * ```
 * 
 * INTEGRATION:
 * 
 * Adapters throw these errors:
 * - HandlebarsAdapter: throws TemplateNotFoundError, TemplateSyntaxError, TemplateRenderError
 * - NunjucksAdapter: throws TemplateNotFoundError, TemplateSyntaxError, TemplateRenderError
 * 
 * Buffer helpers throw:
 * - yieldHelper(): throws BufferNotFoundError
 * 
 * @module template_errors
 * @since 0.2.x
 */

/**
 * Base template error with phase context
 * 
 * All template errors extend this class to ensure consistent formatting
 * with phase labels, context information, and structured display.
 * 
 * FEATURES:
 * - Phase labeling (Template Loading, Template Rendering, etc.)
 * - Structured context (templateName, file paths, etc.)
 * - Consistent format() method for display
 * 
 * USAGE:
 * 
 * Extend this class for specialized template errors:
 * 
 * ```javascript
 * class MyCustomError extends TemplateError {
 *   constructor(templateName, details) {
 *     super('Template Processing', 'Custom error occurred', {
 *       templateName,
 *       details
 *     });
 *   }
 * 
 *   format() {
 *     return `
 * 📋 Phase: ${this.phase}
 * ❌ ${this.name}: ${this.context.templateName}
 * 
 *    ${this.message}
 *     `.trim();
 *   }
 * }
 * ```
 * 
 * @class TemplateError
 * @extends Error
 * @param {string} phase - Build phase (e.g., "Template Loading")
 * @param {string} message - Error message
 * @param {Object} context - Additional context (templateName, paths, etc.)
 */
export class TemplateError extends Error {
  constructor(phase, message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.phase = phase;
    this.context = context;
  }
  
  format() {
    return `📋 Phase: ${this.phase}\n❌ ${this.name}: ${this.message}`;
  }
}

/**
 * Template file not found error
 * 
 * Thrown when template file doesn't exist in any of the searched directories.
 * 
 * WHEN TO USE:
 * - Template file specified but doesn't exist on filesystem
 * - After searching all configured template directories
 * 
 * WHEN NOT TO USE:
 * - Syntax errors (use TemplateSyntaxError)
 * - Render errors (use TemplateRenderError)
 * 
 * CONTEXT INCLUDES:
 * - templateName: Name of missing template
 * - searchedPaths: Array of directories searched
 * - suggestions: Array of similar template names (fuzzy matching)
 * 
 * EXAMPLE:
 * 
 * ```javascript
 * throw new TemplateNotFoundError(
 *   'index.html',
 *   ['/templates/', '/templates/partials/'],
 *   ['index.njk', 'index.hbs'] // Similar names found
 * );
 * ```
 * 
 * OUTPUT:
 * ```
 * 📋 Phase: Template Loading
 * ❌ Template not found: index.html
 * 
 *    Searched in:
 *      • /templates/
 *      • /templates/partials/
 * 
 *    💡 Suggestions:
 *      • Did you mean: index.njk?
 *      • Did you mean: index.hbs?
 * ```
 * 
 * @class TemplateNotFoundError
 * @extends TemplateError
 * @param {string} templateName - Name of template that wasn't found
 * @param {string[]} searchedPaths - Directories that were searched
 * @param {string[]} suggestions - Similar template names (optional)
 */
export class TemplateNotFoundError extends TemplateError {
  constructor(templateName, searchedPaths, suggestions = []) {
    super('Template Loading', `Template not found: ${templateName}`, {
      templateName,
      searchedPaths,
      suggestions
    });
  }
  
  format() {
    const suggestionText = this.context.suggestions.length > 0
      ? '\n\n   💡 Suggestions:\n' + this.context.suggestions.map(s => `     • ${s}`).join('\n')
      : '';
    
    return `
📋 Phase: ${this.phase}
❌ Template not found: ${this.context.templateName}

   Searched in:
${this.context.searchedPaths.map(p => `     - ${p}`).join('\n')}${suggestionText}
    `.trim();
  }
}

/**
 * Template syntax/parse error
 * 
 * Thrown when template has syntax errors that prevent compilation.
 * 
 * WHEN TO USE:
 * - Malformed template syntax (unclosed tags, invalid filters, etc.)
 * - Template engine parse/compile phase fails
 * - Before any rendering occurs
 * 
 * WHEN NOT TO USE:
 * - File not found (use TemplateNotFoundError)
 * - Runtime errors during rendering (use TemplateRenderError)
 * 
 * CONTEXT INCLUDES:
 * - templateName: Template file with syntax error
 * - line: Line number where error occurred (if available)
 * - column: Column number (if available)
 * 
 * EXAMPLE:
 * 
 * ```javascript
 * throw new TemplateSyntaxError(
 *   'layout.njk',
 *   42,
 *   15,
 *   'Unexpected token'
 * );
 * ```
 * 
 * OUTPUT:
 * ```
 * 📋 Phase: Template Parsing
 * ❌ Template syntax error: layout.njk at line 42, column 15
 * 
 *    Unexpected token
 * 
 *    💡 Suggestions:
 *      • Check all control structures are closed ({% if %}/{% endif %})
 *      • Verify filter/helper syntax is correct
 *      • Ensure variable references are properly formed
 * ```
 * 
 * @class TemplateSyntaxError
 * @extends TemplateError
 * @param {string} templateName - Template with syntax error
 * @param {number|null} line - Line number (optional)
 * @param {number|null} column - Column number (optional)
 * @param {string|Error} message - Error message from parser
 */
export class TemplateSyntaxError extends TemplateError {
  constructor(templateName, line, column, message) {
    const errorMessage = typeof message === 'string' ? message : message?.message || 'Syntax error';
    super('Template Parsing', errorMessage, {
      templateName,
      line,
      column
    });
  }
  
  format() {
    const loc = this.context.line 
      ? ` at line ${this.context.line}${this.context.column ? `, column ${this.context.column}` : ''}`
      : '';
    
    return `
📋 Phase: ${this.phase}
❌ Template syntax error: ${this.context.templateName}${loc}

   ${this.message}

   💡 Suggestions:
     • Check all control structures are closed ({% if %}/{% endif %})
     • Verify filter/helper syntax is correct
     • Ensure variable references are properly formed
    `.trim();
  }
}

/**
 * Template render/execution error
 * 
 * Thrown during template rendering when logic errors occur (undefined variables,
 * type mismatches, filter errors, etc.).
 * 
 * WHEN TO USE:
 * - Template compiles but fails during rendering
 * - Undefined variables accessed
 * - Helper/filter throws error
 * - Type mismatches in template logic
 * 
 * WHEN NOT TO USE:
 * - File not found (use TemplateNotFoundError)
 * - Syntax errors (use TemplateSyntaxError)
 * - Buffer-specific errors (use BufferNotFoundError)
 * 
 * CONTEXT INCLUDES:
 * - templateName: Template being rendered
 * - stack: Stack trace (optional, for debugging)
 * 
 * EXAMPLE:
 * 
 * ```javascript
 * throw new TemplateRenderError(
 *   'index.njk',
 *   "Cannot read property 'name' of undefined",
 *   error.stack
 * );
 * ```
 * 
 * OUTPUT:
 * ```
 * 📋 Phase: Template Rendering
 * ❌ Template render error: index.njk
 * 
 *    Cannot read property 'name' of undefined
 * 
 *    💡 Suggestions:
 *      • Check variable names are defined in template context
 *      • Verify helpers/filters are registered
 *      • Ensure data types match filter expectations
 * ```
 * 
 * @class TemplateRenderError
 * @extends TemplateError
 * @param {string} templateName - Template that failed to render
 * @param {string|Error} message - Error message or Error object
 * @param {string|null} stack - Stack trace (optional)
 */
export class TemplateRenderError extends TemplateError {
  constructor(templateName, message, stack = null) {
    const errorMessage = typeof message === 'string' ? message : message?.message || 'Render error';
    super('Template Rendering', errorMessage, {
      templateName,
      stack
    });
  }
  
  format() {
    return `
📋 Phase: ${this.phase}
❌ Template render error: ${this.context.templateName}

   ${this.message}

   💡 Suggestions:
     • Check variable names are defined in template context
     • Verify helpers/filters are registered
     • Ensure data types match filter expectations
    `.trim();
  }
}

/**
 * Buffer not found error
 * 
 * Thrown when {{ yield('bufferName') }} is called but buffer doesn't exist.
 * This indicates a mismatch between {% buffer name %} and {{ yield(name) }}.
 * 
 * WHEN TO USE:
 * - Template calls {{ yield('name') }}
 * - No {% buffer name %} block exists
 * - Buffer system is active but specific buffer missing
 * 
 * WHEN NOT TO USE:
 * - General render errors (use TemplateRenderError)
 * - Template not found (use TemplateNotFoundError)
 * 
 * CONTEXT INCLUDES:
 * - bufferName: Name of buffer that doesn't exist
 * - templateName: Template that tried to yield
 * - availableBuffers: List of buffers that DO exist
 * 
 * EXAMPLE:
 * 
 * ```javascript
 * throw new BufferNotFoundError(
 *   'sidebar',
 *   'layout.njk',
 *   ['header', 'footer', 'content']
 * );
 * ```
 * 
 * OUTPUT:
 * ```
 * 📋 Phase: Buffer Resolution
 * ❌ Buffer not found: sidebar
 *    Template: layout.njk
 * 
 *    Available buffers: header, footer, content
 * 
 *    💡 Suggestions:
 *      • Ensure buffer is created before yield
 *      • Check buffer name spelling matches
 *      • Verify render order (content templates before layouts)
 * ```
 * 
 * BUFFER SYSTEM:
 * 
 * Buffers enable template composition:
 * 
 * ```njk
 * {# Create buffer #}
 * {% buffer sidebar %}
 *   <div>Sidebar content</div>
 * {% endbuffer %}
 * 
 * {# Use buffer #}
 * {{ yield('sidebar') }}  {# Outputs the div #}
 * ```
 * 
 * This error occurs when yield() references non-existent buffer.
 * 
 * @class BufferNotFoundError
 * @extends TemplateError
 * @param {string} bufferName - Name of buffer that wasn't found
 * @param {string} templateName - Template that yielded
 * @param {string[]} availableBuffers - List of existing buffers
 */
export class BufferNotFoundError extends TemplateError {
  constructor(bufferName, templateName, availableBuffers = []) {
    super('Buffer Resolution', `Buffer not found: ${bufferName}`, {
      bufferName,
      templateName,
      availableBuffers
    });
  }
  
  format() {
    const available = this.context.availableBuffers.length > 0
      ? `Available buffers: ${this.context.availableBuffers.join(', ')}`
      : 'No buffers have been created yet';
    
    return `
📋 Phase: ${this.phase}
❌ Buffer not found: ${this.context.bufferName}
   Template: ${this.context.templateName}

   ${available}

   💡 Suggestions:
     • Ensure buffer is created before yield
     • Check buffer name spelling matches
     • Verify render order (content templates before layouts)
    `.trim();
  }
}

/**
 * Circular template extends error (PLANNED FEATURE)
 * 
 * Thrown when template extends chain creates infinite loop.
 * 
 * WHEN TO USE:
 * - Template A extends B extends C extends A (circular)
 * - Infinite inheritance chain detected
 * - During template loading/resolution phase
 * 
 * WHEN NOT TO USE:
 * - General syntax errors (use TemplateSyntaxError)
 * - Render errors (use TemplateRenderError)
 * 
 * STATUS: Planned for future extends/yields implementation
 * 
 * CONTEXT INCLUDES:
 * - chain: Array showing the circular path
 * 
 * EXAMPLE:
 * 
 * ```javascript
 * throw new CircularExtendsError(
 *   ['layout.njk', 'base.njk', 'layout.njk']
 * );
 * ```
 * 
 * OUTPUT:
 * ```
 * 📋 Phase: Template Inheritance
 * ❌ Circular extends detected
 * 
 *    Chain: layout.njk → base.njk → layout.njk
 * 
 *    💡 Suggestions:
 *      • Templates cannot extend themselves directly or indirectly
 *      • Review extends chain to break the cycle
 * ```
 * 
 * @class CircularExtendsError
 * @extends TemplateError
 * @param {string[]} chain - The circular dependency chain
 */
export class CircularExtendsError extends TemplateError {
  constructor(chain) {
    super('Template Inheritance', 'Circular extends detected', {
      chain
    });
  }
  
  format() {
    return `
📋 Phase: ${this.phase}
❌ Circular extends detected

   Chain: ${this.context.chain.join(' → ')}

   💡 Suggestions:
     • Templates cannot extend themselves directly or indirectly
     • Review extends chain to break the cycle
    `.trim();
  }
}
