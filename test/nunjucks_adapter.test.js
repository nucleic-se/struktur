import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import NunjucksAdapter from '../src/adapters/nunjucks_adapter.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('NunjucksAdapter', () => {
  let adapter;
  let tempDir;

  beforeEach(async () => {
    adapter = new NunjucksAdapter();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nunjucks-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('constructor', () => {
    test('creates adapter with default config', () => {
      const adapter = new NunjucksAdapter();
      assert.strictEqual(adapter.getEngineName(), 'nunjucks');
    });

    test('accepts custom config', () => {
      const adapter = new NunjucksAdapter({
        autoescape: false,
        trimBlocks: true,
        throwOnUndefined: true
      });
      assert.strictEqual(adapter.getEngineName(), 'nunjucks');
    });
  });

  describe('setSearchPaths', () => {
    test('sets search paths from array', () => {
      adapter.setSearchPaths(['/path1', '/path2']);
      assert.deepStrictEqual(adapter.searchPaths, ['/path1', '/path2']);
    });

    test('converts single path to array', () => {
      adapter.setSearchPaths('/single/path');
      assert.deepStrictEqual(adapter.searchPaths, ['/single/path']);
    });
  });

  describe('registerHelper', () => {
    test('registers custom filter', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        'Hello {{ name | uppercase }}!',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      adapter.registerHelper('uppercase', (str) => str.toUpperCase());

      const result = await adapter.render('test.njk', { name: 'world' });
      assert.strictEqual(result, 'Hello WORLD!');
    });

    test('supports filters with arguments', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        '{{ value | multiply(3) }}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      adapter.registerHelper('multiply', (val, multiplier) => val * multiplier);

      const result = await adapter.render('test.njk', { value: 5 });
      assert.strictEqual(result, '15');
    });
  });

  describe('registerGlobal', () => {
    test('registers global variable', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        'Site: {{ siteName }}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      adapter.registerGlobal('siteName', 'My Site');

      const result = await adapter.render('test.njk', {});
      assert.strictEqual(result, 'Site: My Site');
    });

    test('registers global function', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        '{{ greet("Alice") }}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      adapter.registerGlobal('greet', (name) => `Hello, ${name}!`);

      const result = await adapter.render('test.njk', {});
      assert.strictEqual(result, 'Hello, Alice!');
    });
  });

  describe('render', () => {
    test('renders simple template', async () => {
      await fs.writeFile(
        path.join(tempDir, 'simple.njk'),
        'Hello {{ name }}!',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('simple.njk', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });

    test('renders template with iteration', async () => {
      await fs.writeFile(
        path.join(tempDir, 'list.njk'),
        '{% for item in items %}{{ item }}{% endfor %}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('list.njk', { items: ['a', 'b', 'c'] });
      assert.strictEqual(result, 'abc');
    });

    test('renders template with conditionals', async () => {
      await fs.writeFile(
        path.join(tempDir, 'conditional.njk'),
        '{% if show %}visible{% else %}hidden{% endif %}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);

      const result1 = await adapter.render('conditional.njk', { show: true });
      assert.strictEqual(result1, 'visible');

      const result2 = await adapter.render('conditional.njk', { show: false });
      assert.strictEqual(result2, 'hidden');
    });

    test('renders template with inheritance', async () => {
      // Base template
      await fs.writeFile(
        path.join(tempDir, 'base.njk'),
        'Start {% block content %}default{% endblock %} End',
        'utf-8'
      );

      // Child template
      await fs.writeFile(
        path.join(tempDir, 'child.njk'),
        '{% extends "base.njk" %}{% block content %}custom{% endblock %}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('child.njk', {});
      assert.strictEqual(result, 'Start custom End');
    });

    test('renders template with includes', async () => {
      // Partial
      await fs.writeFile(
        path.join(tempDir, 'header.njk'),
        'Header Content',
        'utf-8'
      );

      // Main template
      await fs.writeFile(
        path.join(tempDir, 'page.njk'),
        '{% include "header.njk" %} Body',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('page.njk', {});
      assert.strictEqual(result, 'Header Content Body');
    });

    test('searches multiple paths', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');

      await fs.mkdir(dir1);
      await fs.mkdir(dir2);

      await fs.writeFile(path.join(dir1, 'template1.njk'), 'From dir1', 'utf-8');
      await fs.writeFile(path.join(dir2, 'template2.njk'), 'From dir2', 'utf-8');

      adapter.setSearchPaths([dir1, dir2]);

      const result1 = await adapter.render('template1.njk', {});
      assert.strictEqual(result1, 'From dir1');

      const result2 = await adapter.render('template2.njk', {});
      assert.strictEqual(result2, 'From dir2');
    });

    test('throws error for missing template', async () => {
      adapter.setSearchPaths([tempDir]);

      await assert.rejects(
        async () => await adapter.render('missing.njk', {}),
        /Template not found/
      );
    });

    test('throws error if no search paths configured', async () => {
      await assert.rejects(
        async () => await adapter.render('test.njk', {}),
        /No template search paths configured/
      );
    });

    test('auto-adds .njk extension if needed', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.njk'),
        'Hello {{ name }}!',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('test', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });
  });

  describe('loadTemplatesFromDirectory', () => {
    test('loads template names from directory', async () => {
      await fs.writeFile(path.join(tempDir, 'template1.njk'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'template2.html'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'not-template.txt'), '', 'utf-8');

      const templates = await adapter.loadTemplatesFromDirectory(tempDir);
      assert.deepStrictEqual(templates.sort(), ['template1.njk', 'template2.html'].sort());
    });

    test('returns empty array for non-existent directory', async () => {
      const templates = await adapter.loadTemplatesFromDirectory('/nonexistent');
      assert.deepStrictEqual(templates, []);
    });
  });

  describe('autoescape', () => {
    test('escapes HTML by default', async () => {
      await fs.writeFile(
        path.join(tempDir, 'escape.njk'),
        '{{ content }}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('escape.njk', { content: '<script>alert("xss")</script>' });
      assert.match(result, /&lt;script&gt;/);
    });

    test('does not escape when autoescape is false', async () => {
      const noEscapeAdapter = new NunjucksAdapter({ autoescape: false });

      await fs.writeFile(
        path.join(tempDir, 'raw.njk'),
        '{{ content }}',
        'utf-8'
      );

      noEscapeAdapter.setSearchPaths([tempDir]);
      const result = await noEscapeAdapter.render('raw.njk', { content: '<b>bold</b>' });
      assert.strictEqual(result, '<b>bold</b>');
    });

    test('uses safe filter to bypass escaping', async () => {
      await fs.writeFile(
        path.join(tempDir, 'safe.njk'),
        '{{ content | safe }}',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('safe.njk', { content: '<b>bold</b>' });
      assert.strictEqual(result, '<b>bold</b>');
    });
  });

  describe('trimming', () => {
    test('trims blocks by default', async () => {
      await fs.writeFile(
        path.join(tempDir, 'trim.njk'),
        '  {% if true %}\n  content\n  {% endif %}  ',
        'utf-8'
      );

      adapter.setSearchPaths([tempDir]);
      const result = await adapter.render('trim.njk', {});
      assert.strictEqual(result.trim(), 'content');
    });
  });
});
