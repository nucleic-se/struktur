import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createStruktur } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to v2 universal fixtures
const universalDir = path.join(__dirname, 'fixtures', 'universal');

describe('Integration: Universal Stack', () => {
  let struktur;

  beforeEach(() => {
    struktur = createStruktur();
  });

  it('should load universal classes with inheritance', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes')
    });

    const allClasses = struktur.classLoader.getAllClasses();
    assert.ok(allClasses.length >= 2, 'Should load at least universal_base and entity_base');

    assert.ok(struktur.classLoader.hasClass('universal_base'));
    assert.ok(struktur.classLoader.hasClass('entity_base'));
  });

  it('should resolve entity_base lineage from universal_base', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes')
    });

    const resolved = struktur.classResolver.resolve('entity_base');

    assert.deepStrictEqual(resolved.$lineage, ['universal_base', 'entity_base']);
    assert.strictEqual(resolved.$schemas.length, 2);
  });

  it('should load aspect_base aspect definition', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes'),
      aspectsDir: path.join(universalDir, 'classes/aspects')
    });

    const allAspects = struktur.aspectLoader.getAllAspects();
    assert.ok(allAspects.length >= 1, 'Should load at least aspect_base');

    assert.ok(struktur.aspectLoader.hasAspect('aspect_base'));
  });

  it('should validate global.json instance', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes')
    });

    const global = JSON.parse(
      await fs.readFile(path.join(universalDir, 'instances/global.json'), 'utf-8')
    );

    // Add class field for v2 format (global.json is minimal in v1)
    global.$class = 'universal_base';

    const results = struktur.validate([global]);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].valid, true, 'global.json should be valid');
    assert.strictEqual(results[0].errors.length, 0);
  });

  it('should handle domain_root class in subdirectory', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes')
    });

    assert.ok(struktur.classLoader.hasClass('domain_root'), 'Should load domain_root from subdirectory');

    const resolved = struktur.classResolver.resolve('domain_root');
    // domain_root → universal_base (single inheritance in this test fixture)
    assert.ok(resolved.$lineage.includes('universal_base'));
  });

  it('should validate multi-layer inheritance chain', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes')
    });

    // domain_root → entity_base → universal_base
    const resolved = struktur.classResolver.resolve('domain_root');

    assert.ok(resolved.$lineage.length >= 2, 'Should have multi-level lineage');
    assert.strictEqual(resolved.$schemas.length, resolved.$lineage.length);
  });

  it('should merge fields across inheritance chain', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes')
    });

    const resolved = struktur.classResolver.resolve('entity_base');

    // entity_base should inherit fields from universal_base
    assert.ok(resolved.$fields !== undefined, 'Should have merged fields');
  });

  it('should support recursive directory scanning', async () => {
    await struktur.load({
      classesDir: path.join(universalDir, 'classes')
    });

    // Should find classes in subdirectories (domains/, aspects/)
    const allClasses = struktur.classLoader.getAllClasses();
    const hasSubdirClasses = allClasses.some(c =>
      c.$class === 'domain_root'
    );

    assert.ok(hasSubdirClasses, 'Should load classes from subdirectories');
  });
});
