/**
 * Test strict mode for template engines
 * 
 * Verifies that:
 * 1. Handlebars strict mode throws errors on undefined variables
 * 2. Permissive mode (strict=false) allows undefined variables
 * 3. Error messages are helpful for debugging
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { HandlebarsAdapter } from '../src/adapters/handlebars_adapter.js';
import NunjucksAdapter from '../src/adapters/nunjucks_adapter.js';

describe('Template Strict Mode', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Handlebars Strict Mode', () => {
    test('should throw error on undefined variable when strict=true', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Hello {{name}}!',
        'utf-8'
      );

      const adapter = new HandlebarsAdapter({ strict: true });
      adapter.setSearchPaths([tempDir]);

      // Missing 'name' variable should throw
      await assert.rejects(
        async () => await adapter.render('test.hbs', {}),
        (error) => {
          // Handlebars throws: "name" not defined in [object Object]
          return error.message.includes('not defined') || error.message.includes('undefined');
        }
      );
    });

    test('should allow undefined variable when strict=false', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Hello {{name}}!',
        'utf-8'
      );

      const adapter = new HandlebarsAdapter({ strict: false });
      adapter.setSearchPaths([tempDir]);

      // Missing 'name' variable should render empty
      const result = await adapter.render('test.hbs', {});
      assert.strictEqual(result, 'Hello !');
    });

    test('should default to permissive mode when strict not specified', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Hello {{name}}!',
        'utf-8'
      );

      const adapter = new HandlebarsAdapter();
      adapter.setSearchPaths([tempDir]);

      // Without strict config, should be permissive (Handlebars default)
      const result = await adapter.render('test.hbs', {});
      assert.strictEqual(result, 'Hello !');
    });

    test('should work correctly with defined variables in strict mode', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Hello {{name}}!',
        'utf-8'
      );

      const adapter = new HandlebarsAdapter({ strict: true });
      adapter.setSearchPaths([tempDir]);

      const result = await adapter.render('test.hbs', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });

    test('should throw on nested undefined property in strict mode', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Price: {{product.price}}',
        'utf-8'
      );

      const adapter = new HandlebarsAdapter({ strict: true });
      adapter.setSearchPaths([tempDir]);

      // product exists but price is undefined
      await assert.rejects(
        async () => await adapter.render('test.hbs', { product: {} }),
        (error) => {
          return error.message.includes('not defined') || error.message.includes('undefined');
        }
      );
    });

    test('should allow optional chaining-style access in permissive mode', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Price: {{product.price}}',
        'utf-8'
      );

      const adapter = new HandlebarsAdapter({ strict: false });
      adapter.setSearchPaths([tempDir]);

      // Permissive mode: undefined nested property renders empty
      const result = await adapter.render('test.hbs', { product: {} });
      assert.strictEqual(result, 'Price: ');
    });
  });

  describe('Nunjucks Mode (Always Permissive)', () => {
    test('should allow undefined variables by default', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        'Hello {{ name }}!',
        'utf-8'
      );

      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([tempDir]);

      // Nunjucks doesn't have strict mode, always permissive
      const result = await adapter.render('test.njk', {});
      assert.strictEqual(result, 'Hello !');
    });

    test('should not throw on undefined nested properties', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        'Price: {{ product.price }}',
        'utf-8'
      );

      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([tempDir]);

      // Nunjucks gracefully handles undefined
      const result = await adapter.render('test.njk', { product: {} });
      assert.strictEqual(result, 'Price: ');
    });

    test('should work with defined variables', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        'Hello {{ name }}!',
        'utf-8'
      );

      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([tempDir]);

      const result = await adapter.render('test.njk', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });
  });

  describe('Integration with createTemplateAdapter', () => {
    test('should pass strict config to Handlebars adapter', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Hello {{name}}!',
        'utf-8'
      );

      const { createTemplateAdapter } = await import('../src/template_helpers.js');
      const adapter = createTemplateAdapter('handlebars', { strict: true });
      adapter.setSearchPaths([tempDir]);

      await assert.rejects(
        async () => await adapter.render('test.hbs', {}),
        (error) => error.message.includes('not defined') || error.message.includes('undefined')
      );
    });

    test('should create permissive adapter when strict=false', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.hbs'),
        'Hello {{name}}!',
        'utf-8'
      );

      const { createTemplateAdapter } = await import('../src/template_helpers.js');
      const adapter = createTemplateAdapter('handlebars', { strict: false });
      adapter.setSearchPaths([tempDir]);

      const result = await adapter.render('test.hbs', {});
      assert.strictEqual(result, 'Hello !');
    });
  });
});
