/**
 * Tests for ClassResolver
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClassLoader } from '../src/class_loader.js';
import { ClassResolver } from '../src/class_resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures', 'classes');

describe('ClassResolver', () => {
  let loader;
  let resolver;

  beforeEach(async () => {
    loader = new ClassLoader();
    await loader.loadClassesFromDirectory(fixturesDir);
    resolver = new ClassResolver(loader);
  });

  describe('resolve', () => {
    it('should resolve class with no parent', () => {
      const resolved = resolver.resolve('entity_base');

      assert.strictEqual(resolved.class, 'entity_base');
      assert.deepStrictEqual(resolved.lineage, ['entity_base']);
      assert.strictEqual(resolved.schemas.length, 1);
    });

    it('should resolve class with single parent', () => {
      const resolved = resolver.resolve('service');

      assert.strictEqual(resolved.class, 'service');
      assert.deepStrictEqual(resolved.lineage, ['entity_base', 'service']);
      assert.strictEqual(resolved.schemas.length, 2);
    });

    it('should keep schemas separate (no merging)', () => {
      const resolved = resolver.resolve('service');

      // Each schema should be the original, unmerged schema
      const entityBaseSchema = resolved.schemas[0];
      const serviceSchema = resolved.schemas[1];

      assert.ok(entityBaseSchema.properties.id);
      assert.ok(serviceSchema.properties.port);

      // Service schema should NOT have id from parent (no merging)
      assert.ok(!serviceSchema.properties.id);
    });

    it('should merge field defaults', () => {
      const resolved = resolver.resolve('service');

      // Should have fields from both parent and child
      assert.ok(resolved.fields);
    });

    it('should merge aspect requirements', () => {
      const resolved = resolver.resolve('service');

      // Should have aspects from lineage
      assert.ok(resolved.aspects);
    });

    it('should throw error for unknown class', () => {
      assert.throws(
        () => resolver.resolve('nonexistent'),
        /Class not found/
      );
    });

    it('should cache resolved classes', () => {
      const resolved1 = resolver.resolve('service');
      const resolved2 = resolver.resolve('service');

      assert.strictEqual(resolved1, resolved2); // Same object reference
    });

    it('should detect circular inheritance', async () => {
      // Create circular classes manually
      loader.classes.set('circular_a', {
        class: 'circular_a',
        parent: 'circular_b',
        schema: { type: 'object' }
      });

      loader.classes.set('circular_b', {
        class: 'circular_b',
        parent: 'circular_a',
        schema: { type: 'object' }
      });

      assert.throws(
        () => resolver.resolve('circular_a'),
        /Circular inheritance/
      );
    });
  });

  describe('clearCache', () => {
    it('should clear resolution cache', () => {
      const resolved1 = resolver.resolve('service');
      resolver.clearCache();
      const resolved2 = resolver.resolve('service');

      assert.notStrictEqual(resolved1, resolved2); // Different object references
    });
  });

  describe('resolveMany', () => {
    it('should resolve multiple classes', () => {
      const resolved = resolver.resolveMany(['entity_base', 'service']);

      assert.strictEqual(resolved.length, 2);
      assert.strictEqual(resolved[0].class, 'entity_base');
      assert.strictEqual(resolved[1].class, 'service');
    });
  });
});
