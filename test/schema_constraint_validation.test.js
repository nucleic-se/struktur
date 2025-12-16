/**
 * Tests for schema constraint validation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSchemaConstraints, formatConflicts } from '../src/schema_constraint_validator.js';

describe('Schema Constraint Validation', () => {
  
  describe('Numeric Range Conflicts', () => {
    
    it('should detect minimum > maximum conflict', () => {
      const schemas = [
        { type: 'object', properties: { age: { type: 'number', minimum: 65 } } },
        { type: 'object', properties: { age: { type: 'number', maximum: 18 } } }
      ];
      const lineage = ['adult', 'minor'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'impossible');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'RANGE_CONFLICT');
      assert.equal(conflicts[0].path, 'age');
      assert.ok(conflicts[0].message.includes('minimum'));
      assert.ok(conflicts[0].message.includes('maximum'));
    });
    
    it('should allow valid narrowing (child narrows parent range)', () => {
      const schemas = [
        { type: 'object', properties: { age: { type: 'number', minimum: 0, maximum: 100 } } },
        { type: 'object', properties: { age: { type: 'number', minimum: 18, maximum: 65 } } }
      ];
      const lineage = ['person', 'adult'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'adult');
      
      assert.equal(conflicts.length, 0);
    });
    
    it('should detect exclusiveMinimum/exclusiveMaximum conflicts', () => {
      const schemas = [
        { type: 'object', properties: { value: { type: 'number', exclusiveMinimum: 100 } } },
        { type: 'object', properties: { value: { type: 'number', exclusiveMaximum: 90 } } }
      ];
      const lineage = ['base', 'derived'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'derived');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'RANGE_CONFLICT');
    });
  });
  
  describe('Enum Conflicts', () => {
    
    it('should detect disjoint enum sets', () => {
      const schemas = [
        { type: 'object', properties: { status: { enum: ['A', 'B'] } } },
        { type: 'object', properties: { status: { enum: ['C', 'D'] } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'ENUM_CONFLICT');
      assert.equal(conflicts[0].path, 'status');
      assert.ok(conflicts[0].message.includes('empty set'));
    });
    
    it('should allow overlapping enum sets', () => {
      const schemas = [
        { type: 'object', properties: { status: { enum: ['A', 'B', 'C'] } } },
        { type: 'object', properties: { status: { enum: ['B', 'C', 'D'] } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 0);
    });
    
    it('should detect const vs enum conflict', () => {
      const schemas = [
        { type: 'object', properties: { status: { const: 'X' } } },
        { type: 'object', properties: { status: { enum: ['A', 'B', 'C'] } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'ENUM_CONFLICT');
    });
  });
  
  describe('Type Conflicts', () => {
    
    it('should detect incompatible types', () => {
      const schemas = [
        { type: 'object', properties: { value: { type: 'string' } } },
        { type: 'object', properties: { value: { type: 'number' } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'TYPE_CONFLICT');
      assert.equal(conflicts[0].path, 'value');
    });
    
    it('should allow type narrowing', () => {
      const schemas = [
        { type: 'object', properties: { value: { type: ['string', 'number'] } } },
        { type: 'object', properties: { value: { type: 'string' } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 0);
    });
    
    it('should detect empty type intersection', () => {
      const schemas = [
        { type: 'object', properties: { value: { type: ['string', 'boolean'] } } },
        { type: 'object', properties: { value: { type: ['number', 'object'] } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'TYPE_CONFLICT');
    });
  });
  
  describe('String Length Conflicts', () => {
    
    it('should detect minLength > maxLength', () => {
      const schemas = [
        { type: 'object', properties: { name: { type: 'string', minLength: 50 } } },
        { type: 'object', properties: { name: { type: 'string', maxLength: 10 } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'STRING_LENGTH_CONFLICT');
      assert.equal(conflicts[0].path, 'name');
    });
    
    it('should allow valid string length narrowing', () => {
      const schemas = [
        { type: 'object', properties: { name: { type: 'string', minLength: 1, maxLength: 100 } } },
        { type: 'object', properties: { name: { type: 'string', minLength: 5, maxLength: 50 } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 0);
    });
  });
  
  describe('Array Length Conflicts', () => {
    
    it('should detect minItems > maxItems', () => {
      const schemas = [
        { type: 'object', properties: { tags: { type: 'array', minItems: 5 } } },
        { type: 'object', properties: { tags: { type: 'array', maxItems: 2 } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'ARRAY_LENGTH_CONFLICT');
      assert.equal(conflicts[0].path, 'tags');
    });
    
    it('should allow valid array length narrowing', () => {
      const schemas = [
        { type: 'object', properties: { tags: { type: 'array', minItems: 0, maxItems: 10 } } },
        { type: 'object', properties: { tags: { type: 'array', minItems: 1, maxItems: 5 } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 0);
    });
  });
  
  describe('Multi-parent Conflicts', () => {
    
    it('should detect conflicts across multiple parents', () => {
      const schemas = [
        { type: 'object', properties: { age: { type: 'number', minimum: 0 } } },
        { type: 'object', properties: { age: { type: 'number', minimum: 65 } } },
        { type: 'object', properties: { age: { type: 'number', maximum: 18 } } }
      ];
      const lineage = ['person', 'retired', 'minor'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'retired_minor');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'RANGE_CONFLICT');
      assert.equal(conflicts[0].class, 'retired_minor');
    });
    
    it('should detect multiple simultaneous conflicts', () => {
      const schemas = [
        { 
          type: 'object', 
          properties: { 
            age: { type: 'number', minimum: 65 },
            status: { enum: ['A', 'B'] }
          } 
        },
        { 
          type: 'object', 
          properties: { 
            age: { type: 'number', maximum: 18 },
            status: { enum: ['C', 'D'] }
          } 
        }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 2);
      const types = conflicts.map(c => c.type).sort();
      assert.deepEqual(types, ['ENUM_CONFLICT', 'RANGE_CONFLICT']);
    });
  });
  
  describe('Nested Property Conflicts', () => {
    
    it('should detect conflicts in nested properties', () => {
      const schemas = [
        { 
          type: 'object', 
          properties: { 
            config: { 
              type: 'object',
              properties: {
                port: { type: 'number', minimum: 8000 }
              }
            }
          } 
        },
        { 
          type: 'object', 
          properties: { 
            config: { 
              type: 'object',
              properties: {
                port: { type: 'number', maximum: 1024 }
              }
            }
          } 
        }
      ];
      const lineage = ['base', 'derived'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'derived');
      
      assert.equal(conflicts.length, 1);
      assert.equal(conflicts[0].type, 'RANGE_CONFLICT');
      assert.equal(conflicts[0].path, 'config.port');
    });
  });
  
  describe('Conflict Formatting', () => {
    
    it('should format conflicts for display', () => {
      const conflicts = [
        {
          class: 'test_class',
          type: 'RANGE_CONFLICT',
          path: 'age',
          message: 'minimum (65) > maximum (18)',
          details: {
            minimum: 65,
            maximum: 18,
            minSource: 'retired',
            maxSource: 'minor'
          },
          lineage: ['person', 'retired', 'minor'],
          severity: 'ERROR'
        }
      ];
      
      const formatted = formatConflicts(conflicts);
      
      assert.ok(formatted.includes('RANGE_CONFLICT'));
      assert.ok(formatted.includes('test_class'));
      assert.ok(formatted.includes('age'));
      assert.ok(formatted.includes('minimum (65) > maximum (18)'));
      assert.ok(formatted.includes('retired'));
      assert.ok(formatted.includes('minor'));
    });
    
    it('should return success message for no conflicts', () => {
      const formatted = formatConflicts([]);
      assert.ok(formatted.includes('No schema constraint conflicts'));
    });
  });
  
  describe('Edge Cases', () => {
    
    it('should handle empty schemas', () => {
      const conflicts = analyzeSchemaConstraints([], [], 'empty');
      assert.equal(conflicts.length, 0);
    });
    
    it('should handle schemas with no constraints', () => {
      const schemas = [
        { type: 'object', properties: { name: { type: 'string' } } },
        { type: 'object', properties: { age: { type: 'number' } } }
      ];
      const lineage = ['parent', 'child'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'child');
      
      assert.equal(conflicts.length, 0);
    });
    
    it('should handle single schema (no inheritance)', () => {
      const schemas = [
        { type: 'object', properties: { age: { type: 'number', minimum: 0, maximum: 100 } } }
      ];
      const lineage = ['base'];
      const conflicts = analyzeSchemaConstraints(schemas, lineage, 'base');
      
      assert.equal(conflicts.length, 0);
    });
  });
});
