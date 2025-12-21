/**
 * Tests for AspectLoader
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { AspectLoader } from '../src/aspect_loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures', 'aspects');

describe('AspectLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new AspectLoader();
  });

  describe('loadAspect', () => {
    it('should load a valid aspect definition', async () => {
      const aspect = await loader.loadAspect(path.join(fixturesDir, 'aspect_network_interface.class.json'));

      assert.strictEqual(aspect.$aspect, 'aspect_network_interface');
      assert.ok(aspect.$schema);
      assert.ok(aspect.$schema.properties);
    });

    it('should throw error for missing aspect field', async () => {
      const invalidDir = path.join(__dirname, 'fixtures', 'invalid_aspects');
      await assert.rejects(
        async () => loader.loadAspect(path.join(invalidDir, 'aspect_invalid_no_aspect.class.json')),
        /missing '\$aspect' field/
      );
    });

    it('should throw error for missing schema field', async () => {
      const invalidDir = path.join(__dirname, 'fixtures', 'invalid_aspects');
      await assert.rejects(
        async () => loader.loadAspect(path.join(invalidDir, 'invalid_no_schema.class.json')),
        /missing '\$schema' field/
      );
    });

    it('should store aspect in registry', async () => {
      await loader.loadAspect(path.join(fixturesDir, 'aspect_network_interface.class.json'));

      assert.ok(loader.hasAspect('aspect_network_interface'));
      assert.strictEqual(loader.getAspect('aspect_network_interface').$aspect, 'aspect_network_interface');
    });

    it('should detect duplicate aspect names', async () => {
      const filePath = path.join(fixturesDir, 'aspect_network_interface.class.json');
      await loader.loadAspect(filePath);

      // Try to load the same aspect again
      await assert.rejects(
        async () => await loader.loadAspect(filePath),
        {
          message: /Duplicate aspect name 'aspect_network_interface'/
        }
      );
    });
  });

  describe('loadAspectsFromDirectory', () => {
    it('should load all aspects from directory', async () => {
      const aspects = await loader.loadAspectsFromDirectory(fixturesDir);

      assert.ok(aspects.length >= 1);
      assert.ok(loader.hasAspect('aspect_network_interface'));
    });

    it('should handle non-existent directory', async () => {
      await assert.rejects(
        async () => loader.loadAspectsFromDirectory('/nonexistent'),
        /Aspect directory not found/i
      );
    });
  });

  describe('getAspect', () => {
    it('should return undefined for unknown aspect', () => {
      assert.strictEqual(loader.getAspect('nonexistent'), undefined);
    });

    it('should return aspect definition for known aspect', async () => {
      await loader.loadAspect(path.join(fixturesDir, 'aspect_network_interface.class.json'));
      const aspect = loader.getAspect('aspect_network_interface');

      assert.ok(aspect);
      assert.strictEqual(aspect.$aspect, 'aspect_network_interface');
    });
  });

  describe('getAllAspects', () => {
    it('should return empty array when no aspects loaded', () => {
      assert.deepStrictEqual(loader.getAllAspects(), []);
    });

    it('should return all loaded aspects', async () => {
      await loader.loadAspect(path.join(fixturesDir, 'aspect_network_interface.class.json'));

      const aspects = loader.getAllAspects();
      assert.ok(aspects.length >= 1);
    });
  });

  describe('clear', () => {
    it('should clear all loaded aspects', async () => {
      await loader.loadAspect(path.join(fixturesDir, 'aspect_network_interface.class.json'));
      assert.ok(loader.hasAspect('aspect_network_interface'));

      loader.clear();
      assert.ok(!loader.hasAspect('aspect_network_interface'));
      assert.strictEqual(loader.getAllAspects().length, 0);
    });
  });
});
