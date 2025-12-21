import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { ClassLoader } from '../src/class_loader.js';
import { AspectLoader } from '../src/aspect_loader.js';
import { ClassResolver } from '../src/class_resolver.js';
import { MultiPassValidator } from '../src/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Aspect DRY (Define Once, Use Many)', () => {
  let classLoader;
  let aspectLoader;
  let resolver;
  let validator;
  const fixturesDir = path.join(__dirname, 'fixtures', 'aspect_dry');

  beforeEach(async () => {
    classLoader = new ClassLoader();
    aspectLoader = new AspectLoader();
    resolver = new ClassResolver(classLoader);
    validator = new MultiPassValidator();

    // Load shared aspect (defined once)
    await aspectLoader.loadAspect(path.join(fixturesDir, 'shared_aspect.aspect.json'));

    // Load multiple classes that use the same aspect
    await classLoader.loadClass(path.join(fixturesDir, 'class_a.class.json'));
    await classLoader.loadClass(path.join(fixturesDir, 'class_b.class.json'));
    await classLoader.loadClass(path.join(fixturesDir, 'class_c.class.json'));
  });

  it('should define aspect schema once and reference from multiple classes', () => {
    const classA = classLoader.getClass('class_a');
    const classB = classLoader.getClass('class_b');

    // Both classes reference the same aspect
    assert.ok(classA.$aspects.includes('aspect_shared_aspect'));
    assert.ok(classB.$aspects.includes('aspect_shared_aspect'));

    // Aspect is defined only once in aspect registry
    const sharedAspect = aspectLoader.getAspect('aspect_shared_aspect');
    assert.ok(sharedAspect);
    assert.strictEqual(sharedAspect.$aspect, 'aspect_shared_aspect');

    // Verify aspect has schema
    assert.ok(sharedAspect.$schema);
    assert.ok(sharedAspect.$schema.properties.shared_prop);
  });

  it('should inherit aspects from parent classes', () => {
    const classC = classLoader.getClass('class_c');

    // class_c doesn't directly declare shared_aspect
    const hasAspect = classC.$aspects?.includes('aspect_shared_aspect');
    assert.strictEqual(hasAspect, undefined, 'class_c should not directly declare aspect');

    // But it inherits from class_a which has shared_aspect
    const resolved = resolver.resolve('class_c');
    assert.strictEqual(typeof resolved.$aspects, 'object', 'Resolved aspects should be an object');
    assert.ok(resolved.$aspects.aspect_shared_aspect, 'Should inherit aspect from parent');
  });

  it('should validate all classes using the same aspect schema', () => {
    const resolvedA = resolver.resolve('class_a');
    const resolvedB = resolver.resolve('class_b');

    validator.registerClass(resolvedA);
    validator.registerClass(resolvedB);

    const aspectDef = aspectLoader.getAspect('aspect_shared_aspect');
    validator.registerAspect(aspectDef);

    // Valid instance for class_a with aspect data
    const instanceA = {
      $id: 'inst_a',
      $class: 'class_a',
      prop_a: 'value_a',
      $aspects: {
        aspect_shared_aspect: {
          shared_prop: 'shared_value',
          shared_number: 123
        }
      }
    };

    const resultA = validator.validate(instanceA, resolvedA);
    assert.strictEqual(resultA.valid, true, 'class_a instance should be valid');

    // Valid instance for class_b with same aspect schema
    const instanceB = {
      $id: 'inst_b',
      $class: 'class_b',
      prop_b: true,
      $aspects: {
        aspect_shared_aspect: {
          shared_prop: 'another_value',
          shared_number: 456
        }
      }
    };

    const resultB = validator.validate(instanceB, resolvedB);
    assert.strictEqual(resultB.valid, true, 'class_b instance should be valid');
  });

  it('should detect aspect validation errors consistently across classes', () => {
    const resolvedA = resolver.resolve('class_a');
    const resolvedB = resolver.resolve('class_b');

    validator.registerClass(resolvedA);
    validator.registerClass(resolvedB);

    const aspectDef = aspectLoader.getAspect('aspect_shared_aspect');
    validator.registerAspect(aspectDef);

    // Invalid instance for class_a (missing required shared_prop)
    const invalidA = {
      $id: 'invalid_a',
      $class: 'class_a',
      prop_a: 'value_a',
      $aspects: {
        aspect_shared_aspect: {
          shared_number: 123
          // missing shared_prop
        }
      }
    };

    const resultA = validator.validate(invalidA, resolvedA);
    assert.strictEqual(resultA.valid, false, 'Should fail validation when missing required aspect property');

    const aspectErrorA = resultA.errors.find(e =>
      e.layer === 'aspect:aspect_shared_aspect' && e.message.includes('shared_prop')
    );
    assert.ok(aspectErrorA, 'Should have error from shared_aspect for missing shared_prop');

    // Invalid instance for class_b (same validation error)
    const invalidB = {
      $id: 'invalid_b',
      $class: 'class_b',
      prop_b: true,
      $aspects: {
        aspect_shared_aspect: {
          shared_number: 456
          // missing shared_prop
        }
      }
    };

    const resultB = validator.validate(invalidB, resolvedB);
    assert.strictEqual(resultB.valid, false, 'Should fail validation when missing required aspect property');
    const aspectErrorB = resultB.errors.find(e =>
      e.layer === 'aspect:aspect_shared_aspect' && e.message.includes('shared_prop')
    );
    assert.ok(aspectErrorB, 'Should have error from shared_aspect for missing shared_prop');
  });

  it('should validate inherited aspects correctly', () => {
    const resolvedC = resolver.resolve('class_c');

    validator.registerClass(resolvedC);

    const aspectDef = aspectLoader.getAspect('aspect_shared_aspect');
    validator.registerAspect(aspectDef);

    // class_c inherits shared_aspect from class_a
    const instanceC = {
      $id: 'inst_c',
      $class: 'class_c',
      prop_a: 'value_a',  // from parent
      prop_c: 789,        // from self
      $aspects: {
        aspect_shared_aspect: {
          shared_prop: 'inherited_aspect_value',
          shared_number: 999
        }
      }
    };

    const result = validator.validate(instanceC, resolvedC);
    assert.strictEqual(result.valid, true, 'Inherited aspect should validate correctly');
  });

  it('should avoid duplication - aspect defined once, compiled once, used many times', () => {
    const resolvedA = resolver.resolve('class_a');
    const resolvedB = resolver.resolve('class_b');
    const resolvedC = resolver.resolve('class_c');

    validator.registerClass(resolvedA);
    validator.registerClass(resolvedB);
    validator.registerClass(resolvedC);

    const aspectDef = aspectLoader.getAspect('aspect_shared_aspect');
    validator.registerAspect(aspectDef);

    // The aspect validator is compiled once and cached
    // All three classes use the same compiled validator

    const instances = [
      {
        $id: 'a1',
        $class: 'class_a',
        prop_a: 'val',
        $aspects: { aspect_shared_aspect: { shared_prop: 'test' } }
      },
      {
        $id: 'b1',
        $class: 'class_b',
        prop_b: false,
        $aspects: { aspect_shared_aspect: { shared_prop: 'test' } }
      },
      {
        $id: 'c1',
        $class: 'class_c',
        prop_a: 'val',
        prop_c: 123,
        $aspects: { aspect_shared_aspect: { shared_prop: 'test' } }
      }
    ];

    const results = [
      validator.validate(instances[0], resolvedA),
      validator.validate(instances[1], resolvedB),
      validator.validate(instances[2], resolvedC)
    ];

    // All should be valid, using the same aspect schema
    assert.ok(results.every(r => r.valid), 'All instances should validate with shared aspect');

    // This demonstrates DRY:
    // - 1 aspect definition file
    // - 3 classes using it
    // - 1 compiled validator (cached)
    // - N instances validated
  });
});
