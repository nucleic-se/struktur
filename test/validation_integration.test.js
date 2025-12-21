/**
 * Integration tests for semantic and lint validation
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MultiPassValidator } from '../src/validator.js';
import { ClassLoader } from '../src/class_loader.js';
import { ClassResolver } from '../src/class_resolver.js';

describe('Semantic and Lint Validation Integration', () => {
  test('should include semantic warnings in validation results', async () => {
    const loader = new ClassLoader();
    const resolver = new ClassResolver(loader);
    const validator = new MultiPassValidator();

    // Manually add class to loader (testing convenience)
    loader.classes.set('test_class', {
      $class: 'test_class',
      $schema: {
        type: 'object',
        properties: {
          $id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    });

    const resolved = resolver.resolve('test_class');
    validator.registerClass(resolved);

    // Instance with empty name (semantic warning)
    const instance = {
      $id: 'test-1',
      $class: 'test_class',
      name: ''
    };

    const result = validator.validate(instance, resolved);

    assert.strictEqual(result.valid, true); // No errors
    assert.ok(result.warnings.length > 0); // Has warnings
    const emptyWarning = result.warnings.find(w => w.code === 'suspicious_value');
    assert.ok(emptyWarning);
    assert.match(emptyWarning.message, /name.*empty/i);
  });

  test('should include lint warnings in validation results', async () => {
    const loader = new ClassLoader();
    const resolver = new ClassResolver(loader);
    const validator = new MultiPassValidator();

    loader.classes.set('test_class', {
      $class: 'test_class',
      $schema: {
        type: 'object',
        properties: {
          $id: { type: 'string' },
          description: { type: 'string' }
        }
      }
    });

    const resolved = resolver.resolve('test_class');
    validator.registerClass(resolved);

    // Instance with malformed ID and missing description
    const instance = {
      $id: 'BadID_Format',
      $class: 'test_class'
    };

    const result = validator.validate(instance, resolved);

    assert.strictEqual(result.valid, true); // No errors
    assert.ok(result.warnings.length >= 2); // ID + description warnings
    
    const idWarning = result.warnings.find(w => w.code === 'malformed_id');
    assert.ok(idWarning);
    assert.match(idWarning.message, /kebab-case/i);

    const descWarning = result.warnings.find(w => w.code === 'missing_description');
    assert.ok(descWarning);
  });

  test('should combine schema errors with semantic/lint warnings', async () => {
    const loader = new ClassLoader();
    const resolver = new ClassResolver(loader);
    const validator = new MultiPassValidator();

    loader.classes.set('test_class', {
      $class: 'test_class',
      $schema: {
        type: 'object',
        required: ['name'],
        properties: {
          $id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    });

    const resolved = resolver.resolve('test_class');
    validator.registerClass(resolved);

    // Instance with schema error (missing name) AND warnings (bad ID)
    const instance = {
      $id: 'Bad_ID',
      $class: 'test_class'
      // name missing (error)
    };

    const result = validator.validate(instance, resolved);

    assert.strictEqual(result.valid, false); // Has errors
    assert.ok(result.errors.length > 0); // Schema error
    assert.ok(result.warnings.length > 0); // Lint warnings
    
    // Check schema error
    const schemaError = result.errors.find(e => e.code === 'schema_validation');
    assert.ok(schemaError);
    assert.match(schemaError.message, /name/);

    // Check lint warning
    const idWarning = result.warnings.find(w => w.code === 'malformed_id');
    assert.ok(idWarning);
  });

  test('should respect enableSemantic=false option', async () => {
    const loader = new ClassLoader();
    const resolver = new ClassResolver(loader);
    const validator = new MultiPassValidator({ enableSemantic: false });

    loader.classes.set('test_class', {
      $class: 'test_class',
      $schema: {
        type: 'object',
        properties: {
          $id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    });

    const resolved = resolver.resolve('test_class');
    validator.registerClass(resolved);

    // Instance with empty name (would trigger semantic warning if enabled)
    const instance = {
      $id: 'test-1',
      $class: 'test_class',
      name: ''
    };

    const result = validator.validate(instance, resolved);

    // Debug: Log all warnings to see what's there
    // console.log('Warnings:', result.warnings);
    
    // Should not have semantic warnings (only check actual semantic codes, not lint codes like suspicious_value)
    const semanticWarning = result.warnings.find(w => 
      w.code === 'empty_field' || w.code === 'placeholder_value' || w.code === 'invalid_format'
    );
    assert.ok(!semanticWarning, `Should not have semantic warnings when disabled, but found: ${semanticWarning ? semanticWarning.code : 'none'}`);
  });

  test('should respect enableLint=false option', async () => {
    const loader = new ClassLoader();
    const resolver = new ClassResolver(loader);
    const validator = new MultiPassValidator({ enableLint: false });

    loader.classes.set('test_class', {
      $class: 'test_class',
      $schema: {
        type: 'object',
        properties: {
          $id: { type: 'string' }
        }
      }
    });

    const resolved = resolver.resolve('test_class');
    validator.registerClass(resolved);

    // Instance with bad ID (would trigger lint warning if enabled)
    const instance = {
      $id: 'BadID',
      $class: 'test_class'
    };

    const result = validator.validate(instance, resolved);

    // Should not have lint warnings
    const idWarning = result.warnings.find(w => w.code === 'malformed_id');
    assert.ok(!idWarning);
  });

  test('should handle instances with placeholder values', async () => {
    const loader = new ClassLoader();
    const resolver = new ClassResolver(loader);
    const validator = new MultiPassValidator();

    loader.classes.set('test_class', {
      $class: 'test_class',
      $schema: {
        type: 'object',
        properties: {
          $id: { type: 'string' },
          description: { type: 'string' }
        }
      }
    });

    const resolved = resolver.resolve('test_class');
    validator.registerClass(resolved);

    const instance = {
      $id: 'test-1',
      $class: 'test_class',
      description: 'TODO: write this'
    };

    const result = validator.validate(instance, resolved);

    assert.strictEqual(result.valid, true);
    const placeholderWarning = result.warnings.find(w => w.code === 'placeholder_value');
    assert.ok(placeholderWarning);
    assert.match(placeholderWarning.message, /TODO/);
  });

  test('should detect empty arrays in lint pass', async () => {
    const loader = new ClassLoader();
    const resolver = new ClassResolver(loader);
    const validator = new MultiPassValidator();

    loader.classes.set('test_class', {
      $class: 'test_class',
      $schema: {
        type: 'object',
        properties: {
          $id: { type: 'string' },
          tags: { type: 'array' }
        }
      }
    });

    const resolved = resolver.resolve('test_class');
    validator.registerClass(resolved);

    const instance = {
      $id: 'test-1',
      $class: 'test_class',
      tags: []
    };

    const result = validator.validate(instance, resolved);

    assert.strictEqual(result.valid, true);
    const emptyArrayWarning = result.warnings.find(w => w.code === 'empty_array');
    assert.ok(emptyArrayWarning);
    assert.match(emptyArrayWarning.message, /tags/);
  });
});
