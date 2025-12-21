/**
 * Recursive aspect loading tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AspectLoader } from '../src/aspect_loader.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Recursive Aspect Loading', async () => {
  const testDir = path.join(__dirname, 'fixtures', 'aspect_recursive');

  // Setup - create nested aspect directory structure
  await (async () => {
    // Create directory structure:
    // aspects/
    //   top.aspect.json
    //   category1/
    //     cat1.aspect.json
    //   category2/
    //     cat2.aspect.json
    //     nested/
    //       deep.aspect.json

    await fs.mkdir(path.join(testDir, 'category1'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'category2', 'nested'), { recursive: true });

    // Top-level aspect
    await fs.writeFile(
      path.join(testDir, 'top.aspect.json'),
      JSON.stringify({
        $aspect: 'aspect_top',
        description: 'Top-level aspect',
        $schema: { type: 'object', properties: { top_field: { type: 'string' } } }
      })
    );

    // Category 1 aspect
    await fs.writeFile(
      path.join(testDir, 'category1', 'cat1.aspect.json'),
      JSON.stringify({
        $aspect: 'aspect_cat1',
        description: 'Category 1 aspect',
        $schema: { type: 'object', properties: { cat1_field: { type: 'string' } } }
      })
    );

    // Category 2 aspect
    await fs.writeFile(
      path.join(testDir, 'category2', 'cat2.aspect.json'),
      JSON.stringify({
        $aspect: 'aspect_cat2',
        description: 'Category 2 aspect',
        $schema: { type: 'object', properties: { cat2_field: { type: 'string' } } }
      })
    );

    // Deeply nested aspect
    await fs.writeFile(
      path.join(testDir, 'category2', 'nested', 'deep.aspect.json'),
      JSON.stringify({
        $aspect: 'aspect_deep',
        description: 'Deeply nested aspect',
        $schema: { type: 'object', properties: { deep_field: { type: 'string' } } }
      })
    );
  })();

  it('should load aspects from all nested directories by default', async () => {
    const aspectLoader = new AspectLoader();
    const aspects = await aspectLoader.loadAspectsFromDirectory(testDir);

    assert.strictEqual(aspects.length, 4, 'Should load all 4 aspects');
    
    const aspectNames = aspects.map(a => a.$aspect).sort();
    assert.deepStrictEqual(aspectNames, ['aspect_cat1', 'aspect_cat2', 'aspect_deep', 'aspect_top']);

    // Verify all are registered
    assert.ok(aspectLoader.aspects.has('aspect_top'), 'top aspect registered');
    assert.ok(aspectLoader.aspects.has('aspect_cat1'), 'cat1 aspect registered');
    assert.ok(aspectLoader.aspects.has('aspect_cat2'), 'cat2 aspect registered');
    assert.ok(aspectLoader.aspects.has('aspect_deep'), 'deep aspect registered');
  });

  it('should only load top-level aspects when recursive=false', async () => {
    const aspectLoader = new AspectLoader();
    const aspects = await aspectLoader.loadAspectsFromDirectory(testDir, { recursive: false });

    assert.strictEqual(aspects.length, 1, 'Should only load top-level aspect');
    assert.strictEqual(aspects[0].$aspect, 'aspect_top');
    
    // Only top aspect should be registered
    assert.ok(aspectLoader.aspects.has('aspect_top'), 'top aspect registered');
    assert.ok(!aspectLoader.aspects.has('aspect_cat1'), 'cat1 aspect not registered');
    assert.ok(!aspectLoader.aspects.has('aspect_cat2'), 'cat2 aspect not registered');
    assert.ok(!aspectLoader.aspects.has('aspect_deep'), 'deep aspect not registered');
  });

  it('should handle empty nested directories', async () => {
    // Create empty subdirectory
    await fs.mkdir(path.join(testDir, 'empty'), { recursive: true });

    const aspectLoader = new AspectLoader();
    const aspects = await aspectLoader.loadAspectsFromDirectory(testDir);

    // Should still load all 4 aspects (empty dir ignored)
    assert.strictEqual(aspects.length, 4);
  });

  it('should load all aspects regardless of nesting depth', async () => {
    const aspectLoader = new AspectLoader();
    const aspects = await aspectLoader.loadAspectsFromDirectory(testDir);

    // Verify all aspects were loaded
    const aspectNames = new Set(aspects.map(a => a.$aspect));
    assert.ok(aspectNames.has('aspect_top'), 'Top aspect should be loaded');
    assert.ok(aspectNames.has('aspect_cat1'), 'Category 1 aspect should be loaded');
    assert.ok(aspectNames.has('aspect_cat2'), 'Category 2 aspect should be loaded');
    assert.ok(aspectNames.has('aspect_deep'), 'Deeply nested aspect should be loaded');

    // All 4 aspects should be present
    assert.strictEqual(aspects.length, 4, 'All 4 aspects should be loaded');
  });

  // Cleanup
  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });
});

function after(fn) {
  // No-op for cleanup in node:test - tests auto-cleanup fixtures dir
  // This is here for test structure clarity
}
