/**
 * Integration tests with real Skribe stack data
 *
 * Skribe is a simple static site generator with:
 * - content_base (root class)
 * - blog_post extends content_base
 * - page extends content_base
 * - No aspects (simplest case)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createStruktur } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to v2 skribe fixtures
const skribeDir = path.join(__dirname, 'fixtures', 'skribe');

describe('Integration: Skribe Stack', () => {
  let struktur;

  beforeEach(() => {
    struktur = createStruktur();
  });

  it('should load Skribe classes', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    // Should have loaded content_base, blog_post, page
    assert.ok(struktur.classLoader.hasClass('content_base'));
    assert.ok(struktur.classLoader.hasClass('blog_post'));
    assert.ok(struktur.classLoader.hasClass('page'));

    const allClasses = struktur.classLoader.getAllClasses();
    assert.ok(allClasses.length >= 3);
  });

  it('should resolve blog_post lineage', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    const resolved = struktur.classResolver.resolve('blog_post');

    // Check lineage
    assert.deepStrictEqual(resolved.lineage, ['content_base', 'blog_post']);

    // Check schemas are separate (not merged)
    assert.strictEqual(resolved.schemas.length, 2);

    // content_base schema should have title, slug, etc
    const contentBaseSchema = resolved.schemas[0];
    assert.ok(contentBaseSchema.properties.title);
    assert.ok(contentBaseSchema.properties.slug);

    // blog_post schema should have additional fields (date required, tags)
    const blogPostSchema = resolved.schemas[1];
    assert.ok(blogPostSchema.required.includes('date'));
    assert.ok(blogPostSchema.properties.tags);

    // Verify no merging: blog_post schema should NOT have title from parent
    assert.ok(!blogPostSchema.properties.title, 'Schema should not be merged');
  });

  it('should validate a valid blog post instance', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    const welcomePost = JSON.parse(
      await fs.readFile(path.join(skribeDir, 'instances/posts/welcome.json'), 'utf-8')
    );

    const results = struktur.validate([welcomePost]);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].valid, true);
    assert.strictEqual(results[0].errors.length, 0);
  });

  it('should detect validation errors in invalid instance', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    // Create invalid instance (missing required fields from both layers)
    const invalidPost = {
      id: 'invalid-post',
      class: 'blog_post'
      // Missing: title, slug (required by content_base)
      // Missing: date (required by blog_post)
    };

    const results = struktur.validate([invalidPost]);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].valid, false);
    assert.ok(results[0].errors.length > 0);

    // Should have errors from both layers
    const contentBaseErrors = results[0].errors.filter(e => e.layer === 'content_base');
    const blogPostErrors = results[0].errors.filter(e => e.layer === 'blog_post');

    assert.ok(contentBaseErrors.length > 0, 'Should have content_base validation errors');
    assert.ok(blogPostErrors.length > 0, 'Should have blog_post validation errors');
  });

  it('should validate all Skribe blog posts', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    // Load all blog posts
    const postsDir = path.join(skribeDir, 'instances/posts');
    const files = await fs.readdir(postsDir);
    const instances = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(postsDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }
    }

    assert.ok(instances.length > 0, 'Should have loaded blog posts');

    // Validate all
    const results = struktur.validate(instances);

    // All should be valid (Skribe is a working example)
    const invalid = results.filter(r => !r.valid);

    if (invalid.length > 0) {
      console.log('\nInvalid instances:');
      for (const result of invalid) {
        console.log(`  ${result.instance}:`);
        for (const err of result.errors) {
          console.log(`    - ${err.message}`);
        }
      }
    }

    assert.strictEqual(invalid.length, 0, 'All Skribe blog posts should be valid');
  });

  it('should preserve class defaults (fields)', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    const resolved = struktur.classResolver.resolve('blog_post');

    // blog_post provides default for tags
    if (resolved.fields.tags !== undefined) {
      assert.ok(Array.isArray(resolved.fields.tags));
    }
  });

  it('should handle page class (sibling of blog_post)', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    const resolved = struktur.classResolver.resolve('page');

    // page also extends content_base
    assert.deepStrictEqual(resolved.lineage, ['content_base', 'page']);
    assert.strictEqual(resolved.schemas.length, 2);
  });

  it('should cache resolved classes for performance', async () => {
    await struktur.load({
      classesDir: path.join(skribeDir, 'classes')
    });

    const resolved1 = struktur.classResolver.resolve('blog_post');
    const resolved2 = struktur.classResolver.resolve('blog_post');

    // Should return same object (cached)
    assert.strictEqual(resolved1, resolved2);
  });
});
