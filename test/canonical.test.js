/**
 * Canonical Output Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { generateCanonical, generateCanonicalWithValidation } from '../src/canonical.js';
import { ClassLoader } from '../src/class_loader.js';
import { ClassResolver } from '../src/class_resolver.js';
import { createStruktur } from '../src/index.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../package.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('Canonical Output', () => {
  it('should generate canonical output with instances', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [
      { $id: 'test1', $class: 'page', title: 'Test Page' },
      { $id: 'test2', $class: 'blog_post', title: 'Test Post' }
    ];

    const canonical = generateCanonical(instances, resolver);

    assert.ok(canonical.$instances, 'Should have $instances array');
    assert.equal(canonical.$instances.length, 2, 'Should have 2 instances');
    assert.equal(canonical.$instances[0].$id, 'test1', 'First instance should be test1');
    assert.equal(canonical.$instances[1].$id, 'test2', 'Second instance should be test2');
  });

  it('should merge instances with class field defaults', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [
      { $id: 'test1', $class: 'page', title: 'Test Page' }
    ];

    const canonical = generateCanonical(instances, resolver);
    const obj = canonical.$instances[0];

    // Should have both instance fields and class defaults
    assert.equal(obj.$id, 'test1', 'Should preserve instance id');
    assert.equal(obj.title, 'Test Page', 'Should preserve instance title');
    assert.equal(obj.$class, 'page', 'Should preserve class');
  });

  it('should not auto-populate $uses_aspects on instances', async () => {
    const loader = new ClassLoader();
    loader.classes.set('service', {
      $class: 'service',
      $uses_aspects: ['aspect_network'],
      $schema: { type: 'object' }
    });
    const resolver = new ClassResolver(loader);

    const instances = [
      { $id: 'svc-1', $class: 'service' }
    ];

    const canonical = generateCanonical(instances, resolver);
    const obj = canonical.$instances[0];

    assert.equal(obj.$uses_aspects, undefined, 'Should not add $uses_aspects to instances');
    assert.ok(obj.$aspects, 'Should still merge aspect data');
  });

  it('should generate class index', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [
      { $id: 'page1', $class: 'page', title: 'Page 1' },
      { $id: 'page2', $class: 'page', title: 'Page 2' },
      { $id: 'post1', $class: 'blog_post', title: 'Post 1' }
    ];

    const canonical = generateCanonical(instances, resolver);

    assert.ok(canonical.$classes_by_id, 'Should have $classes_by_id');
    assert.ok(typeof canonical.$classes_by_id.page === 'object', 'Should have page class object');
    assert.ok(typeof canonical.$classes_by_id.blog_post === 'object', 'Should have blog_post class object');
    assert.strictEqual(canonical.$classes_by_id.page.$class, 'page', 'Page class should have class field');
    assert.strictEqual(canonical.$classes_by_id.blog_post.$class, 'blog_post', 'Blog post class should have class field');
    assert.ok(Array.isArray(canonical.$classes_by_id.page.$lineage), 'Page should have lineage');
    assert.ok(Array.isArray(canonical.$classes_by_id.blog_post.$lineage), 'Blog post should have lineage');
  });

  it('should include metadata by default', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [
      { $id: 'test1', $class: 'page', title: 'Test' }
    ];

    const canonical = generateCanonical(instances, resolver);

    assert.ok(canonical.$metadata, 'Should have metadata');
    assert.equal(canonical.$metadata.version, PACKAGE_VERSION, 'Should have version');
    assert.equal(canonical.$metadata.generator, 'struktur', 'Should have generator');
    assert.equal(canonical.$metadata.count, 1, 'Should have instance count');
    assert.equal(canonical.$metadata.classes, 1, 'Should have class count');
    assert.ok(canonical.$metadata.timestamp, 'Should have timestamp');
  });

  it('should support disabling metadata', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [{ $id: 'test1', $class: 'page', title: 'Test' }];
    const canonical = generateCanonical(instances, resolver, { includeMetadata: false });

    assert.equal(canonical.$metadata, undefined, 'Should not have metadata');
  });

  it('should support disabling class index', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [{ $id: 'test1', $class: 'page', title: 'Test' }];
    const canonical = generateCanonical(instances, resolver, { includeClassIndex: false });

    assert.equal(canonical.$classes_by_id, undefined, 'Should not have class index');
  });

  it('should handle instances with aspects', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'universal', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [
      {
        $id: 'test1',
        $class: 'entity_base',
        $aspects: {
          aspect_test_aspect: {
            value: 'test'
          }
        }
      }
    ];

    const canonical = generateCanonical(instances, resolver);

    assert.ok(canonical.$instances[0].$aspects, 'Should preserve aspects');
    assert.equal(canonical.$instances[0].$aspects.aspect_test_aspect.value, 'test', 'Should preserve aspect data');
  });

  it('should handle unknown classes gracefully', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const instances = [
      { $id: 'test1', $class: 'unknown_class', title: 'Test' }
    ];

    const canonical = generateCanonical(instances, resolver);

    assert.ok(canonical.$instances, 'Should still generate output');
    assert.equal(canonical.$instances.length, 1, 'Should include instance');
    assert.equal(canonical.$instances[0].$id, 'test1', 'Should preserve instance');
  });

  it('should generate canonical with validation metadata', async () => {
    const struktur = createStruktur();
    await struktur.load({
      classesDir: join(FIXTURES_DIR, 'skribe', 'classes')
    });

    const instances = [
      { $id: 'valid', $class: 'page', title: 'Valid Page' }
    ];

    const canonical = generateCanonicalWithValidation(instances, struktur);

    assert.ok(canonical.$validation, 'Should have validation metadata');
    assert.equal(canonical.$validation.total, 1, 'Should have 1 total');
    assert.ok(canonical.$validation.valid >= 0, 'Should have valid count');
    assert.ok(canonical.$validation.invalid >= 0, 'Should have invalid count');
  });

  it('should preserve instance values over class defaults', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    // Assume page class has default status: 'draft'
    const instances = [
      { $id: 'test1', $class: 'page', title: 'Test', status: 'published' }
    ];

    const canonical = generateCanonical(instances, resolver);

    // Instance value should win over class default
    assert.equal(canonical.$instances[0].status, 'published', 'Instance value should override default');
  });

  it('should handle empty instances array', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const canonical = generateCanonical([], resolver);

    assert.ok(canonical.$instances, 'Should have $instances array');
    assert.equal(canonical.$instances.length, 0, 'Should be empty');
    assert.ok(canonical.$metadata, 'Should have metadata');
    assert.equal(canonical.$metadata.count, 0, 'Should show 0 count');
  });

  it('should use custom timestamp', async () => {
    const loader = new ClassLoader();
    await loader.loadClassesFromDirectory(join(FIXTURES_DIR, 'skribe', 'classes'));
    const resolver = new ClassResolver(loader);

    const customTime = '2025-01-01T00:00:00.000Z';
    const instances = [{ $id: 'test1', $class: 'page', title: 'Test' }];
    const canonical = generateCanonical(instances, resolver, { timestamp: customTime });

    assert.equal(canonical.$metadata.timestamp, customTime, 'Should use custom timestamp');
  });
});
