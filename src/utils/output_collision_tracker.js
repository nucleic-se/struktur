import path from 'path';

export class OutputCollisionTracker {
  constructor() {
    this.outputs = new Map();
  }

  register(outputPath, context = {}) {
    const normalized = path.resolve(outputPath);
    const existing = this.outputs.get(normalized);
    if (existing) {
      throw new Error(
        `Output file collision: multiple outputs target the same file\n` +
        `  File: ${normalized}\n` +
        `  First: ${this._formatContext(existing)}\n` +
        `  Second: ${this._formatContext(context)}\n` +
        `  Hint: Use unique output paths in templates or remove one output`
      );
    }
    this.outputs.set(normalized, context);
  }

  _formatContext(context) {
    const template = context.template || '(unknown template)';
    const instance = context.instance || null;
    const source = context.source || 'render';
    if (instance) {
      return `${instance} (${template}, ${source})`;
    }
    return `${template} (${source})`;
  }
}
