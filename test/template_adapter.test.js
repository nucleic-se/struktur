/**
 * Template Adapter Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TemplateAdapter } from '../src/template_adapter.js';

describe('TemplateAdapter', () => {
  it('should be abstract base class', () => {
    const adapter = new TemplateAdapter();
    assert.ok(adapter instanceof TemplateAdapter);
  });

  it('should throw on render() if not implemented', async () => {
    const adapter = new TemplateAdapter();
    await assert.rejects(
      () => adapter.render('test.hbs', {}),
      /must be implemented/
    );
  });

  it('should throw on registerHelper() if not implemented', () => {
    const adapter = new TemplateAdapter();
    assert.throws(
      () => adapter.registerHelper('test', () => {}),
      /must be implemented/
    );
  });

  it('should throw on setSearchPaths() if not implemented', () => {
    const adapter = new TemplateAdapter();
    assert.throws(
      () => adapter.setSearchPaths(['/tmp']),
      /must be implemented/
    );
  });

  it('should return class name from getEngineName()', () => {
    const adapter = new TemplateAdapter();
    assert.strictEqual(adapter.getEngineName(), 'TemplateAdapter');
  });

  it('should accept config in constructor', () => {
    const config = { foo: 'bar' };
    const adapter = new TemplateAdapter(config);
    assert.deepStrictEqual(adapter.config, config);
  });
});
