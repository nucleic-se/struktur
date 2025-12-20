/**
 * Template Error Classes
 * Structured error hierarchy for template operations with phase context
 */

/**
 * Base template error with phase context
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
 * Template file not found
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
 * Template render error (undefined variable, logic error, etc.)
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
 * Buffer not found (yield references non-existent buffer)
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
 * Circular template inheritance
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
