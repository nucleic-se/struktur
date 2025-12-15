import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MultiPassValidator } from '../src/validator.js';

describe('MultiPassValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new MultiPassValidator();
  });

  describe('registerClass', () => {
    it('should register a class with valid schema', () => {
      const resolvedClass = {
        class: 'test_class',
        lineage: ['base', 'test_class'],
        schemas: [
          { type: 'object', properties: { id: { type: 'string' } } },
          { type: 'object', properties: { name: { type: 'string' } } }
        ],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      // Should compile and cache validators for each layer
      assert.ok(validator.classValidators.has('base'));
      assert.ok(validator.classValidators.has('test_class'));
      assert.strictEqual(validator.classValidators.size, 2);
    });

    it('should not recompile validators for already registered classes', () => {
      const resolvedClass = {
        class: 'test_class',
        lineage: ['test_class'],
        schemas: [{ type: 'object', properties: { id: { type: 'string' } } }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);
      const firstValidator = validator.classValidators.get('test_class');

      // Register same class again
      validator.registerClass(resolvedClass);
      const secondValidator = validator.classValidators.get('test_class');

      // Should be same cached validator
      assert.strictEqual(firstValidator, secondValidator);
    });

    it('should handle schemas with complex validation rules', () => {
      const resolvedClass = {
        class: 'complex_class',
        lineage: ['complex_class'],
        schemas: [{
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[a-z0-9_-]+$' },
            count: { type: 'number', minimum: 0, maximum: 100 },
            tags: { type: 'array', items: { type: 'string' }, minItems: 1 }
          },
          required: ['id', 'count']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      assert.ok(validator.classValidators.has('complex_class'));
    });
  });

  describe('registerAspect', () => {
    it('should register an aspect with valid schema', () => {
      const aspectDef = {
        aspect: 'test_aspect',
        schema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          },
          required: ['value']
        }
      };

      validator.registerAspect(aspectDef);

      assert.ok(validator.aspectValidators.has('test_aspect'));
      assert.strictEqual(validator.aspectValidators.size, 1);
    });

    it('should not recompile validators for already registered aspects', () => {
      const aspectDef = {
        aspect: 'test_aspect',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } }
        }
      };

      validator.registerAspect(aspectDef);
      const firstValidator = validator.aspectValidators.get('test_aspect');

      validator.registerAspect(aspectDef);
      const secondValidator = validator.aspectValidators.get('test_aspect');

      assert.strictEqual(firstValidator, secondValidator);
    });

    it('should handle aspects with nested schemas', () => {
      const aspectDef = {
        aspect: 'nested_aspect',
        schema: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                host: { type: 'string' },
                port: { type: 'number' }
              },
              required: ['host']
            }
          },
          required: ['config']
        }
      };

      validator.registerAspect(aspectDef);

      assert.ok(validator.aspectValidators.has('nested_aspect'));
    });
  });

  describe('validate', () => {
    it('should validate a valid instance against simple schema', () => {
      const resolvedClass = {
        class: 'simple',
        lineage: ['simple'],
        schemas: [{
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['id']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instance = {
        id: 'test-1',
        name: 'Test Instance'
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect missing required properties', () => {
      const resolvedClass = {
        class: 'simple',
        lineage: ['simple'],
        schemas: [{
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['id', 'name']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instance = {
        id: 'test-1'
        // missing name
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);

      const error = result.errors[0];
      assert.strictEqual(error.level, 'error');
      assert.strictEqual(error.layer, 'simple');
      assert.ok(error.message.includes('name'));
    });

    it('should detect wrong property types', () => {
      const resolvedClass = {
        class: 'typed',
        lineage: ['typed'],
        schemas: [{
          type: 'object',
          properties: {
            id: { type: 'string' },
            count: { type: 'number' }
          }
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instance = {
        id: 'test-1',
        count: 'not-a-number'
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.message.includes('count')));
    });

    it('should validate through entire lineage chain', () => {
      const resolvedClass = {
        class: 'child',
        lineage: ['parent', 'child'],
        schemas: [
          {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id']
          },
          {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name']
          }
        ],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      // Valid against both schemas
      const validInstance = {
        id: 'test-1',
        name: 'Test'
      };

      const validResult = validator.validate(validInstance, resolvedClass);
      assert.strictEqual(validResult.valid, true);

      // Invalid - missing property required by parent
      const invalidInstance = {
        name: 'Test'
        // missing id required by parent
      };

      const invalidResult = validator.validate(invalidInstance, resolvedClass);
      assert.strictEqual(invalidResult.valid, false);
      assert.ok(invalidResult.errors.some(e => e.layer === 'parent'));
    });

    it('should validate aspect data when present', () => {
      const resolvedClass = {
        class: 'with_aspect',
        lineage: ['with_aspect'],
        schemas: [{
          type: 'object',
          properties: { id: { type: 'string' } }
        }],
        fields: {},
        aspects: ['test_aspect']
      };

      const aspectDef = {
        aspect: 'test_aspect',
        schema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          },
          required: ['value']
        }
      };

      validator.registerClass(resolvedClass);
      validator.registerAspect(aspectDef);

      const instance = {
        id: 'test-1',
        aspects: {
          test_aspect: {
            value: 'test-value'
          }
        }
      };

      const result = validator.validate(instance, resolvedClass);
      assert.strictEqual(result.valid, true);
    });

    it('should detect invalid aspect data', () => {
      const resolvedClass = {
        class: 'with_aspect',
        lineage: ['with_aspect'],
        schemas: [{
          type: 'object',
          properties: { id: { type: 'string' } }
        }],
        fields: {},
        aspects: ['test_aspect']
      };

      const aspectDef = {
        aspect: 'test_aspect',
        schema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          },
          required: ['value']
        }
      };

      validator.registerClass(resolvedClass);
      validator.registerAspect(aspectDef);

      const instance = {
        id: 'test-1',
        aspects: {
          test_aspect: {
            // missing required value
          }
        }
      };

      const result = validator.validate(instance, resolvedClass);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.layer === 'aspect:test_aspect'));
    });

    it('should skip validation for optional aspects not provided', () => {
      const resolvedClass = {
        class: 'with_optional_aspect',
        lineage: ['with_optional_aspect'],
        schemas: [{
          type: 'object',
          properties: { id: { type: 'string' } }
        }],
        fields: {},
        aspects: ['optional_aspect']
      };

      const aspectDef = {
        aspect: 'optional_aspect',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value']
        }
      };

      validator.registerClass(resolvedClass);
      validator.registerAspect(aspectDef);

      const instance = {
        id: 'test-1'
        // no aspects provided
      };

      const result = validator.validate(instance, resolvedClass);
      assert.strictEqual(result.valid, true);
    });

    it('should handle missing validator gracefully', () => {
      const resolvedClass = {
        class: 'unregistered',
        lineage: ['unregistered'],
        schemas: [{ type: 'object' }],
        fields: {},
        aspects: []
      };

      // Don't register the class
      const instance = { id: 'test' };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e =>
        e.code === 'no_validator' && e.layer === 'unregistered'
      ));
    });

    it('should handle missing aspect validator gracefully', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{ type: 'object', properties: { id: { type: 'string' } } }],
        fields: {},
        aspects: ['unregistered_aspect']
      };

      validator.registerClass(resolvedClass);
      // Don't register the aspect

      const instance = {
        id: 'test',
        aspects: {
          unregistered_aspect: { value: 'something' }
        }
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e =>
        e.code === 'no_validator' && e.layer === 'aspect:unregistered_aspect'
      ));
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple instances', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['id']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instances = [
        { id: 'test-1', class: 'test', name: 'First' },
        { id: 'test-2', class: 'test', name: 'Second' },
        { id: 'test-3', class: 'test', name: 'Third' }
      ];

      const getResolvedClass = (_className) => resolvedClass;
      const results = validator.validateBatch(instances, getResolvedClass);

      assert.strictEqual(results.length, 3);
      assert.ok(results.every(r => r.valid === true));
      assert.ok(results.every(r => r.instance));
      assert.ok(results.every(r => r.class === 'test'));
    });

    it('should detect errors in batch validation', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{
          type: 'object',
          properties: {
            id: { type: 'string' },
            count: { type: 'number' }
          },
          required: ['id', 'count']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instances = [
        { id: 'test-1', class: 'test', count: 10 },       // valid
        { id: 'test-2', class: 'test' },                   // missing count
        { id: 'test-3', class: 'test', count: 'invalid' }  // wrong type
      ];

      const getResolvedClass = (_className) => resolvedClass;
      const results = validator.validateBatch(instances, getResolvedClass);

      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].valid, true);
      assert.strictEqual(results[1].valid, false);
      assert.strictEqual(results[2].valid, false);
    });

    it('should continue validation after errors', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instances = [
        { class: 'test' },              // missing id
        { id: 'test-2', class: 'test' }, // valid
        { class: 'test' }                // missing id
      ];

      const getResolvedClass = (_className) => resolvedClass;
      const results = validator.validateBatch(instances, getResolvedClass);

      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].valid, false);
      assert.strictEqual(results[1].valid, true);
      assert.strictEqual(results[2].valid, false);
    });
  });

  describe('error formatting', () => {
    it('should format schema errors with layer and path', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                value: { type: 'string' }
              },
              required: ['value']
            }
          },
          required: ['nested']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instance = {
        nested: {
          // missing value
        }
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      const error = result.errors[0];
      assert.strictEqual(error.level, 'error');
      assert.strictEqual(error.code, 'schema_validation');
      assert.strictEqual(error.layer, 'test');
      assert.ok(error.path);
      assert.ok(error.message);
      assert.ok(error.ajvError);
    });

    it('should format aspect errors with aspect context', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{ type: 'object', properties: { id: { type: 'string' } } }],
        fields: {},
        aspects: ['test_aspect']
      };

      const aspectDef = {
        aspect: 'test_aspect',
        schema: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                host: { type: 'string' }
              },
              required: ['host']
            }
          },
          required: ['config']
        }
      };

      validator.registerClass(resolvedClass);
      validator.registerAspect(aspectDef);

      const instance = {
        id: 'test',
        aspects: {
          test_aspect: {
            config: {
              // missing host
            }
          }
        }
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      const error = result.errors[0];
      assert.strictEqual(error.level, 'error');
      assert.strictEqual(error.code, 'aspect_validation');
      assert.strictEqual(error.layer, 'aspect:test_aspect');
      assert.strictEqual(error.aspect, 'test_aspect');
      assert.ok(error.path);
      assert.ok(error.message.includes('test_aspect'));
    });

    it('should include instance id in error messages', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{
          type: 'object',
          properties: { value: { type: 'number' } },
          required: ['value']
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instance = {
        id: 'my-instance-123'
        // missing value
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      const error = result.errors[0];
      assert.strictEqual(error.instance, 'my-instance-123');
    });
  });

  describe('edge cases', () => {
    it('should handle empty lineage', () => {
      const resolvedClass = {
        class: 'test',
        lineage: [],
        schemas: [],
        fields: {},
        aspects: []
      };

      const instance = { id: 'test' };
      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should handle empty aspects array', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{ type: 'object' }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instance = { id: 'test' };
      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, true);
    });

    it('should handle object format aspects', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{ type: 'object', properties: { id: { type: 'string' } } }],
        fields: {},
        aspects: {
          required_aspect: { required: true },
          optional_aspect: { required: false }
        }
      };

      const aspectDef = {
        aspect: 'required_aspect',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value']
        }
      };

      validator.registerClass(resolvedClass);
      validator.registerAspect(aspectDef);

      // Missing required aspect
      const instance = {
        id: 'test'
        // no aspects
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e =>
        e.code === 'missing_required_aspect' && e.aspect === 'required_aspect'
      ));
    });

    it('should handle instances without id field', () => {
      const resolvedClass = {
        class: 'test',
        lineage: ['test'],
        schemas: [{
          type: 'object',
          properties: { value: { type: 'string' } }
        }],
        fields: {},
        aspects: []
      };

      validator.registerClass(resolvedClass);

      const instance = {
        value: 'test'
        // no id field
      };

      const result = validator.validate(instance, resolvedClass);

      assert.strictEqual(result.valid, true);
      // Errors should have undefined instance id
      assert.strictEqual(result.errors.length, 0);
    });
  });
});
