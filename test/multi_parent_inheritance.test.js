import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { ClassLoader } from '../src/class_loader.js';
import { ClassResolver } from '../src/class_resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Multi-Parent Inheritance', () => {
  let classLoader;
  let resolver;

  beforeEach(async () => {
    classLoader = new ClassLoader();
    resolver = new ClassResolver(classLoader);

    // Load test fixtures
    const fixturesDir = path.join(__dirname, 'fixtures', 'multi_parent');
    await classLoader.loadClass(path.join(fixturesDir, 'mixin_a.schema.json'));
    await classLoader.loadClass(path.join(fixturesDir, 'mixin_b.schema.json'));
    await classLoader.loadClass(path.join(fixturesDir, 'multi_parent.schema.json'));
  });

  it('should support multi-parent inheritance in class definition', () => {
    const multiParent = classLoader.getClass('multi_parent');

    assert.ok(multiParent);
    assert.ok(Array.isArray(multiParent.inherits_from));
    assert.strictEqual(multiParent.inherits_from.length, 2);
    assert.ok(multiParent.inherits_from.includes('mixin_a'));
    assert.ok(multiParent.inherits_from.includes('mixin_b'));
  });

  it('should resolve multi-parent lineage in left-to-right order', () => {
    const resolved = resolver.resolve('multi_parent');

    // Should include all parents in lineage
    assert.ok(resolved.lineage.includes('mixin_a'));
    assert.ok(resolved.lineage.includes('mixin_b'));
    assert.ok(resolved.lineage.includes('multi_parent'));

    // Length should be 3 (both parents + self)
    assert.strictEqual(resolved.lineage.length, 3);

    // Parents should come before child
    const indexA = resolved.lineage.indexOf('mixin_a');
    const indexB = resolved.lineage.indexOf('mixin_b');
    const indexChild = resolved.lineage.indexOf('multi_parent');

    assert.ok(indexA < indexChild);
    assert.ok(indexB < indexChild);
  });

  it('should collect schemas from all parents', () => {
    const resolved = resolver.resolve('multi_parent');

    // Should have one schema per lineage entry
    assert.strictEqual(resolved.schemas.length, resolved.lineage.length);
    assert.strictEqual(resolved.schemas.length, 3);
  });

  it('should merge fields from all parents', () => {
    const resolved = resolver.resolve('multi_parent');

    // Should have fields from both parents
    assert.strictEqual(resolved.fields.prop_a, 'default_a');
    assert.strictEqual(resolved.fields.prop_b, 42);
    assert.strictEqual(resolved.fields.prop_c, true);
  });

  it('should validate against all parent schemas in multi-pass', async () => {
    const { MultiPassValidator } = await import('../src/validator.js');
    const validator = new MultiPassValidator();

    const resolved = resolver.resolve('multi_parent');
    validator.registerClass(resolved);

    // Valid instance (has all required fields)
    const validInstance = {
      id: 'test',
      class: 'multi_parent',
      prop_a: 'value_a',
      prop_b: 100,
      prop_c: false
    };

    const result = validator.validate(validInstance, resolved);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should detect missing fields from any parent', async () => {
    const { MultiPassValidator } = await import('../src/validator.js');
    const validator = new MultiPassValidator();

    const resolved = resolver.resolve('multi_parent');
    validator.registerClass(resolved);

    // Missing prop_b (required by mixin_b)
    const invalidInstance = {
      id: 'test',
      class: 'multi_parent',
      prop_a: 'value_a',
      prop_c: false
    };

    const result = validator.validate(invalidInstance, resolved);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);

    // Should have error from mixin_b layer
    const mixinBError = result.errors.find(e => e.layer === 'mixin_b');
    assert.ok(mixinBError, 'Should have error from mixin_b layer');
  });
});
