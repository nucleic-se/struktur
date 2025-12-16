/**
 * Tests for LintValidator - Data quality linting
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LintValidator } from '../src/lint_validator.js';

describe('LintValidator', () => {
  describe('missing description check', () => {
    test('should warn when description is missing', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', name: 'Test' };
      const warnings = validator.validateInstance(instance);
      
      const descWarning = warnings.find(w => w.code === 'missing_description');
      assert.ok(descWarning);
      assert.strictEqual(descWarning.level, 'warning');
      assert.match(descWarning.message, /description/i);
    });

    test('should warn when description is empty string', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', description: '' };
      const warnings = validator.validateInstance(instance);
      
      const descWarning = warnings.find(w => w.code === 'missing_description');
      assert.ok(descWarning);
    });

    test('should warn when description is only whitespace', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', description: '   ' };
      const warnings = validator.validateInstance(instance);
      
      const descWarning = warnings.find(w => w.code === 'missing_description');
      assert.ok(descWarning);
    });

    test('should not warn when description is present', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', description: 'A valid description' };
      const warnings = validator.validateInstance(instance);
      
      const descWarning = warnings.find(w => w.code === 'missing_description');
      assert.ok(!descWarning);
    });
  });

  describe('malformed ID check', () => {
    test('should accept valid kebab-case IDs', () => {
      const validator = new LintValidator();
      const valid = ['test', 'test-1', 'my-long-id', 'id-with-many-parts'];
      
      for (const id of valid) {
        const warnings = validator.validateInstance({ id });
        const idWarning = warnings.find(w => w.code === 'malformed_id');
        assert.ok(!idWarning, `Should accept: ${id}`);
      }
    });

    test('should reject IDs with uppercase', () => {
      const validator = new LintValidator();
      const instance = { id: 'TestId' };
      const warnings = validator.validateInstance(instance);
      
      const idWarning = warnings.find(w => w.code === 'malformed_id');
      assert.ok(idWarning);
      assert.match(idWarning.message, /kebab-case/i);
    });

    test('should reject IDs with underscores', () => {
      const validator = new LintValidator();
      const instance = { id: 'test_id' };
      const warnings = validator.validateInstance(instance);
      
      const idWarning = warnings.find(w => w.code === 'malformed_id');
      assert.ok(idWarning);
    });

    test('should reject IDs starting with hyphen', () => {
      const validator = new LintValidator();
      const instance = { id: '-test' };
      const warnings = validator.validateInstance(instance);
      
      const idWarning = warnings.find(w => w.code === 'malformed_id');
      assert.ok(idWarning);
    });

    test('should reject IDs ending with hyphen', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-' };
      const warnings = validator.validateInstance(instance);
      
      const idWarning = warnings.find(w => w.code === 'malformed_id');
      assert.ok(idWarning);
    });

    test('should reject IDs with consecutive hyphens', () => {
      const validator = new LintValidator();
      const instance = { id: 'test--id' };
      const warnings = validator.validateInstance(instance);
      
      const idWarning = warnings.find(w => w.code === 'malformed_id');
      assert.ok(idWarning);
    });
  });

  describe('empty array check', () => {
    test('should warn on empty tags array', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', tags: [] };
      const warnings = validator.validateInstance(instance);
      
      const arrayWarning = warnings.find(w => w.code === 'empty_array');
      assert.ok(arrayWarning);
      assert.match(arrayWarning.message, /tags/);
    });

    test('should not warn on non-empty tags array', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', tags: ['web', 'api'] };
      const warnings = validator.validateInstance(instance);
      
      const arrayWarning = warnings.find(w => w.code === 'empty_array');
      assert.ok(!arrayWarning);
    });

    test('should not warn when tags field is missing', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1' };
      const warnings = validator.validateInstance(instance);
      
      const arrayWarning = warnings.find(w => w.code === 'empty_array');
      assert.ok(!arrayWarning);
    });

    test('should check other array fields', () => {
      const validator = new LintValidator();
      const instance = { 
        id: 'test-1',
        categories: [],
        labels: []
      };
      const warnings = validator.validateInstance(instance);
      
      const arrayWarnings = warnings.filter(w => w.code === 'empty_array');
      assert.ok(arrayWarnings.length >= 2); // Both categories and labels
    });
  });

  describe('suspicious values check', () => {
    test('should warn on default port 0', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', port: 0 };
      const warnings = validator.validateInstance(instance);
      
      const portWarning = warnings.find(w => w.code === 'suspicious_value');
      assert.ok(portWarning);
      assert.match(portWarning.message, /port.*0/i);
    });

    test('should warn on empty name', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', name: '' };
      const warnings = validator.validateInstance(instance);
      
      const nameWarning = warnings.find(w => w.code === 'suspicious_value');
      assert.ok(nameWarning);
    });

    test('should not warn on valid port', () => {
      const validator = new LintValidator();
      const instance = { id: 'test-1', port: 8080 };
      const warnings = validator.validateInstance(instance);
      
      const portWarning = warnings.find(w => w.code === 'suspicious_value');
      assert.ok(!portWarning);
    });
  });

  describe('validateInstance', () => {
    test('should return warnings with instance context', () => {
      const validator = new LintValidator();
      const instance = { 
        id: 'BadID',
        description: ''
      };
      const warnings = validator.validateInstance(instance);
      
      assert.ok(warnings.length > 0);
      assert.ok(warnings.every(w => w.instance === 'BadID'));
      assert.ok(warnings.every(w => w.level === 'warning'));
    });

    test('should handle instances without issues', () => {
      const validator = new LintValidator();
      const instance = { 
        id: 'good-id',
        name: 'Good Name',
        description: 'Good description',
        port: 8080
      };
      const warnings = validator.validateInstance(instance);
      
      assert.strictEqual(warnings.length, 0);
    });

    test('should detect multiple issues in one instance', () => {
      const validator = new LintValidator();
      const instance = { 
        id: 'Bad_ID',
        description: '',
        tags: [],
        port: 0
      };
      const warnings = validator.validateInstance(instance);
      
      assert.ok(warnings.length >= 4); // ID, description, tags, port
      const codes = warnings.map(w => w.code);
      assert.ok(codes.includes('malformed_id'));
      assert.ok(codes.includes('missing_description'));
      assert.ok(codes.includes('empty_array'));
      assert.ok(codes.includes('suspicious_value'));
    });
  });

  describe('configuration', () => {
    test('should allow disabling specific checks', () => {
      const validator = new LintValidator({
        checkDescription: false,
        checkId: false
      });
      const instance = { id: 'BadID', description: '' };
      const warnings = validator.validateInstance(instance);
      
      const descWarning = warnings.find(w => w.code === 'missing_description');
      const idWarning = warnings.find(w => w.code === 'malformed_id');
      assert.ok(!descWarning);
      assert.ok(!idWarning);
    });

    test('should allow custom array fields to check', () => {
      const validator = new LintValidator({
        arrayFields: ['custom_array']
      });
      const instance = { 
        id: 'test-1',
        custom_array: [],
        tags: [] // Should not be checked
      };
      const warnings = validator.validateInstance(instance);
      
      const arrayWarnings = warnings.filter(w => w.code === 'empty_array');
      assert.strictEqual(arrayWarnings.length, 1);
      assert.match(arrayWarnings[0].message, /custom_array/);
    });
  });
});
