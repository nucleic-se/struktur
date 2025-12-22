/**
 * Test that helpers persist when setSearchPaths recreates the Nunjucks environment
 * 
 * This test verifies the fix for: task_fix_template_helpers.md
 * Root cause: setSearchPaths() recreates the Nunjucks environment, losing registered helpers
 * Fix: Track helpers/globals and re-register them when environment is recreated
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import NunjucksAdapter from '../src/adapters/nunjucks_adapter.js';

describe('Nunjucks Helper Persistence', () => {
  let tempDir;
  let adapter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-test-'));
    adapter = new NunjucksAdapter();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('helpers should persist when setSearchPaths is called', async () => {
    // Create test template
    await fs.writeFile(
      path.join(tempDir, 'test.njk'),
      '{{ name | uppercase }}',
      'utf-8'
    );

    // Register helper BEFORE setSearchPaths
    adapter.registerHelper('uppercase', (str) => str.toUpperCase());

    // Call setSearchPaths (this recreates the environment in NunjucksAdapter)
    adapter.setSearchPaths([tempDir]);

    // Helper should still work after setSearchPaths
    const result = await adapter.render('test.njk', { name: 'world' });
    assert.strictEqual(result, 'WORLD');
  });

  test('multiple helpers should persist', async () => {
    await fs.writeFile(
      path.join(tempDir, 'test.njk'),
      '{{ name | uppercase }} {{ value | double }}',
      'utf-8'
    );

    // Register multiple helpers
    adapter.registerHelper('uppercase', (str) => str.toUpperCase());
    adapter.registerHelper('double', (num) => num * 2);

    // Call setSearchPaths
    adapter.setSearchPaths([tempDir]);

    // Both helpers should work
    const result = await adapter.render('test.njk', { name: 'hello', value: 5 });
    assert.strictEqual(result, 'HELLO 10');
  });

  test('globals should persist when setSearchPaths is called', async () => {
    await fs.writeFile(
      path.join(tempDir, 'test.njk'),
      'Site: {{ siteName }}',
      'utf-8'
    );

    // Register global BEFORE setSearchPaths
    adapter.registerGlobal('siteName', 'My Site');

    // Call setSearchPaths
    adapter.setSearchPaths([tempDir]);

    // Global should still work
    const result = await adapter.render('test.njk', {});
    assert.strictEqual(result, 'Site: My Site');
  });

  test('helpers registered AFTER setSearchPaths should also work', async () => {
    await fs.writeFile(
      path.join(tempDir, 'test.njk'),
      '{{ name | uppercase }}',
      'utf-8'
    );

    // Call setSearchPaths first
    adapter.setSearchPaths([tempDir]);

    // Register helper AFTER setSearchPaths
    adapter.registerHelper('uppercase', (str) => str.toUpperCase());

    // Helper should work
    const result = await adapter.render('test.njk', { name: 'world' });
    assert.strictEqual(result, 'WORLD');
  });

  test('calling setSearchPaths multiple times should preserve helpers', async () => {
    await fs.writeFile(
      path.join(tempDir, 'test.njk'),
      '{{ name | uppercase }}',
      'utf-8'
    );

    // Register helper
    adapter.registerHelper('uppercase', (str) => str.toUpperCase());

    // Call setSearchPaths multiple times
    adapter.setSearchPaths([tempDir]);
    adapter.setSearchPaths([tempDir]); // Second call
    adapter.setSearchPaths([tempDir]); // Third call

    // Helper should still work after multiple calls
    const result = await adapter.render('test.njk', { name: 'persistent' });
    assert.strictEqual(result, 'PERSISTENT');
  });

  test('simulates real build.js flow: setSearchPaths then registerHelpers', async () => {
    await fs.writeFile(
      path.join(tempDir, 'test.njk'),
      '{{ items | length }} items, first: {{ items | filter_test | length }}',
      'utf-8'
    );

    // Simulate build.js line 319: adapter.setSearchPaths(templatePaths)
    adapter.setSearchPaths([tempDir]);

    // Simulate build.js line 324: await renderer.registerHelpers(canonical)
    // This would call adapter.registerHelper() for each helper
    adapter.registerHelper('filter_test', (arr) => arr.filter(x => x > 5));

    // Helpers should work in templates
    const result = await adapter.render('test.njk', { 
      items: [1, 3, 7, 9] 
    });
    assert.strictEqual(result, '4 items, first: 2');
  });
});
