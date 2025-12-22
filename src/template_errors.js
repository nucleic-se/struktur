/**
 * Template Error Hierarchy
 * 
 * Structured error classes for template system with phase context and formatting.
 * 
 * Hierarchy:
 *   TemplateError (base)
 *   ├─ TemplateNotFoundError   - Template file doesn't exist
 *   ├─ TemplateSyntaxError     - Parse error
 *   ├─ TemplateRenderError     - Runtime error
 *   ├─ BufferNotFoundError     - yield() for missing buffer
 *   └─ CircularExtendsError    - Infinite extends loop
 * 
 * All errors include:
 *   - Phase context (Template Loading, Rendering, etc.)
 *   - format() method for structured display
 *   - Smart suggestions based on error type
 * 
 * @module template_errors
 * @since 0.2.x
 */

/**
 * Base template error with phase context
 * 
 * All template errors extend this class for consistent formatting.
 * 
 * @extends Error
 * @param {string} phase - Build phase (e.g., "Template Loading")
 * @param {string} message - Error message
 * @param {Object} context - Additional context
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
 * Template not found error
 * 
 * Thrown when template file doesn't exist in searched directories.
 * 
 * @extends TemplateError
 * @param {string} templateName - Template that wasn't found
 * @param {string[]} searchedPaths - Directories searched
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
 * Thrown when template has syntax errors preventing compilation.
 * 
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
 * Thrown during rendering when logic errors occur (undefined variables, etc.).
 * 
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
 * Thrown when yield() is called for a non-existent buffer.
 * 
 * @extends TemplateError
 * @param {string} bufferName - Buffer that wasn't found
 * @param {string} templateName - Template that yielded
 * @param {string[]} availableBuffers - Existing buffers
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
 * Circular template extends error
 * 
 * Thrown when template extends chain creates infinite loop.
 * 
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
