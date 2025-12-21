/**
 * Tests for canonical structure validation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCanonical } from '../src/canonical_validator.js';

describe('Canonical Structure Validation', () => {
  
  describe('valid structures', () => {
    
    it('should validate minimal valid structure', async () => {
      const canonical = {
        $instances: [
          { $id: 'test1', $class: 'TestClass' }
        ],
        $instances_by_id: {
          test1: { $id: 'test1', $class: 'TestClass' }
        }
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, true, 'Should be valid');
      assert.equal(result.errors.length, 0, 'Should have no errors');
    });
    
    it('should validate structure with classes', async () => {
      const canonical = {
        $instances: [
          { $id: 'test1', $class: 'TestClass' }
        ],
        $instances_by_id: {
          test1: { $id: 'test1', $class: 'TestClass' }
        },
        $classes: [
          { $class: 'TestClass', $lineage: ['TestClass'], $schemas: [{}] }
        ],
        $classes_by_id: {
          TestClass: { $class: 'TestClass', $lineage: ['TestClass'], $schemas: [{}] }
        }
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, true, 'Should be valid');
    });
    
    it('should validate structure with aspects', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {},
        $aspects: [
          { $aspect: 'test_aspect', $schema: {} }
        ],
        $aspects_by_id: {
          aspect_test_aspect: { $aspect: 'test_aspect', $schema: {} }
        }
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, true, 'Should be valid');
    });
    
    it('should validate structure with metadata', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {},
        $metadata: {
          timestamp: '2025-12-16T00:00:00.000Z',
          version: '0.2.5-alpha',
          generator: 'struktur'
        }
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, true, 'Should be valid');
    });
    
    it('should validate structure with validation results', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {},
        $validation: {
          total: 0,
          valid: 0,
          invalid: 0,
          errors: []
        }
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, true, 'Should be valid');
    });
  });
  
  describe('invalid structures', () => {
    
    it('should reject structure missing $instances', async () => {
      const canonical = {
        $instances_by_id: {}
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, false, 'Should be invalid');
      assert.ok(result.errors.length > 0, 'Should have errors');
    });
    
    it('should reject structure missing $instances_by_id', async () => {
      const canonical = {
        $instances: []
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, false, 'Should be invalid');
      assert.ok(result.errors.length > 0, 'Should have errors');
    });
    
    it('should reject $instances with wrong type', async () => {
      const canonical = {
        $instances: "not an array",
        $instances_by_id: {}
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, false, 'Should be invalid');
    });
    
    it('should reject $instances_by_id with wrong type', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: []
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, false, 'Should be invalid');
    });
    
    it('should reject classes with wrong structure', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {},
        $classes: [
          { $class: 'TestClass' } // missing $lineage and $schemas
        ]
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, false, 'Should be invalid');
    });
    
    it('should reject aspects with wrong structure', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {},
        $aspects: [
          { $aspect: 'test' } // missing schema
        ]
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, false, 'Should be invalid');
    });
    
    it('should reject invalid metadata', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {},
        $metadata: "not an object"
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, false, 'Should be invalid');
    });
  });
  
  describe('edge cases', () => {
    
    it('should handle empty arrays', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {}
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, true, 'Empty arrays should be valid');
    });
    
    it('should handle empty objects', async () => {
      const canonical = {
        $instances: [],
        $instances_by_id: {},
        $classes_by_id: {},
        $aspects_by_id: {}
      };
      
      const result = await validateCanonical(canonical);
      assert.equal(result.valid, true, 'Empty objects should be valid');
    });
  });
});
