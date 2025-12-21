/**
 * Tests for ClassLoader
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClassLoader } from '../src/class_loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures', 'classes');

describe('ClassLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new ClassLoader();
  });

  describe('loadClass', () => {
    it('should load a valid class definition', async () => {
      const classDef = await loader.loadClass(path.join(fixturesDir, 'entity_base.class.json'));

      assert.strictEqual(classDef.$class, 'entity_base');
      assert.ok(classDef.$schema);
      assert.ok(classDef.$schema.properties);
    });

    it('should throw error for missing class field', async () => {
      const invalidDir = path.join(__dirname, 'fixtures', 'invalid_classes');
      await assert.rejects(
        async () => loader.loadClass(path.join(invalidDir, 'invalid_no_class.class.json')),
        /missing '\$class' field/
      );
    });

    it('should throw error for missing schema field', async () => {
      const invalidDir = path.join(__dirname, 'fixtures', 'invalid_classes');
      await assert.rejects(
        async () => loader.loadClass(path.join(invalidDir, 'invalid_no_schema.class.json')),
        /missing '\$schema' field/
      );
    });

    it('should store class in registry', async () => {
      await loader.loadClass(path.join(fixturesDir, 'entity_base.class.json'));

      assert.ok(loader.hasClass('entity_base'));
      assert.strictEqual(loader.getClass('entity_base').$class, 'entity_base');
    });

    it('should detect duplicate class names', async () => {
      const filePath = path.join(fixturesDir, 'entity_base.class.json');
      await loader.loadClass(filePath);

      // Try to load the same class again
      await assert.rejects(
        async () => await loader.loadClass(filePath),
        {
          message: /Duplicate class name 'entity_base'/
        }
      );
    });
  });

  describe('loadClassesFromDirectory', () => {
    it('should load all classes from directory', async () => {
      const classes = await loader.loadClassesFromDirectory(fixturesDir);

      assert.ok(classes.length >= 2);
      assert.ok(loader.hasClass('entity_base'));
      assert.ok(loader.hasClass('service'));
    });

    it('should handle non-existent directory', async () => {
      const classes = await loader.loadClassesFromDirectory('/nonexistent');
      assert.strictEqual(classes.length, 0);
    });

    it('should load recursively by default', async () => {
      const classes = await loader.loadClassesFromDirectory(fixturesDir);
      // Should find classes in subdirectories too
      assert.ok(classes.length > 0);
    });
  });

  describe('getClass', () => {
    it('should return undefined for unknown class', () => {
      assert.strictEqual(loader.getClass('nonexistent'), undefined);
    });

    it('should return class definition for known class', async () => {
      await loader.loadClass(path.join(fixturesDir, 'entity_base.class.json'));
      const classDef = loader.getClass('entity_base');

      assert.ok(classDef);
      assert.strictEqual(classDef.$class, 'entity_base');
    });
  });

  describe('getAllClasses', () => {
    it('should return empty array when no classes loaded', () => {
      assert.deepStrictEqual(loader.getAllClasses(), []);
    });

    it('should return all loaded classes', async () => {
      await loader.loadClass(path.join(fixturesDir, 'entity_base.class.json'));
      await loader.loadClass(path.join(fixturesDir, 'service.class.json'));

      const classes = loader.getAllClasses();
      assert.strictEqual(classes.length, 2);
    });
  });

  describe('clear', () => {
    it('should clear all loaded classes', async () => {
      await loader.loadClass(path.join(fixturesDir, 'entity_base.class.json'));
      assert.ok(loader.hasClass('entity_base'));

      loader.clear();
      assert.ok(!loader.hasClass('entity_base'));
      assert.strictEqual(loader.getAllClasses().length, 0);
    });
  });
});
