/**
 * Tests for SemanticValidator - Format and quality checking
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SemanticValidator } from '../src/semantic_validator.js';

describe('SemanticValidator', () => {
  describe('format validation', () => {
    test('should accept valid email', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('user@example.com', 'email'), true);
      assert.strictEqual(validator.checkFormat('test.user+tag@domain.co.uk', 'email'), true);
    });

    test('should reject invalid email', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('not-an-email', 'email'), false);
      assert.strictEqual(validator.checkFormat('@example.com', 'email'), false);
      assert.strictEqual(validator.checkFormat('user@', 'email'), false);
    });

    test('should accept valid URI', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('https://example.com', 'uri'), true);
      assert.strictEqual(validator.checkFormat('http://localhost:8080/path', 'uri'), true);
    });

    test('should reject invalid URI', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('not-a-uri', 'uri'), false);
      assert.strictEqual(validator.checkFormat('ftp://example.com', 'uri'), false);
    });

    test('should accept valid hostname', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('example.com', 'hostname'), true);
      assert.strictEqual(validator.checkFormat('sub.domain.example.com', 'hostname'), true);
      assert.strictEqual(validator.checkFormat('localhost', 'hostname'), true);
    });

    test('should reject invalid hostname', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('-invalid.com', 'hostname'), false);
      assert.strictEqual(validator.checkFormat('domain-.com', 'hostname'), false);
      assert.strictEqual(validator.checkFormat('UPPERCASE.COM', 'hostname'), false);
    });

    test('should accept valid IPv4', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('192.168.1.1', 'ipv4'), true);
      assert.strictEqual(validator.checkFormat('10.0.0.1', 'ipv4'), true);
    });

    test('should reject invalid IPv4', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('256.1.1.1', 'ipv4'), false);
      assert.strictEqual(validator.checkFormat('192.168.1', 'ipv4'), false);
      assert.strictEqual(validator.checkFormat('not-an-ip', 'ipv4'), false);
    });

    test('should accept valid port', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat(80, 'port'), true);
      assert.strictEqual(validator.checkFormat(8080, 'port'), true);
      assert.strictEqual(validator.checkFormat(65535, 'port'), true);
    });

    test('should reject invalid port', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat(0, 'port'), false);
      assert.strictEqual(validator.checkFormat(-1, 'port'), false);
      assert.strictEqual(validator.checkFormat(65536, 'port'), false);
      assert.strictEqual(validator.checkFormat('8080', 'port'), false); // String
    });

    test('should return true for unknown format', () => {
      const validator = new SemanticValidator();
      assert.strictEqual(validator.checkFormat('anything', 'unknown-format'), true);
    });
  });

  describe('quality checks', () => {
    test('should detect empty name field', () => {
      const validator = new SemanticValidator();
      const instance = { $id: 'test-1', name: '' };
      const warnings = validator.checkQuality(instance);
      
      const emptyWarning = warnings.find(w => w.code === 'empty_field');
      assert.ok(emptyWarning);
      assert.strictEqual(emptyWarning.level, 'warning');
      assert.match(emptyWarning.message, /name.*empty/i);
    });

    test('should detect TODO placeholder', () => {
      const validator = new SemanticValidator();
      const instance = { $id: 'test-1', description: 'TODO: fill this in' };
      const warnings = validator.checkQuality(instance);
      
      const todoWarning = warnings.find(w => w.code === 'placeholder_value');
      assert.ok(todoWarning);
      assert.strictEqual(todoWarning.level, 'warning');
      assert.match(todoWarning.message, /placeholder/i);
    });

    test('should detect FIXME placeholder', () => {
      const validator = new SemanticValidator();
      const instance = { $id: 'test-1', notes: 'FIXME: broken' };
      const warnings = validator.checkQuality(instance);
      
      const fixmeWarning = warnings.find(w => w.code === 'placeholder_value');
      assert.ok(fixmeWarning);
      assert.match(fixmeWarning.message, /FIXME/);
    });

    test('should detect XXX placeholder', () => {
      const validator = new SemanticValidator();
      const instance = { $id: 'test-1', comment: 'XXX: review this' };
      const warnings = validator.checkQuality(instance);
      
      const xxxWarning = warnings.find(w => w.code === 'placeholder_value');
      assert.ok(xxxWarning);
    });

    test('should detect TBD placeholder', () => {
      const validator = new SemanticValidator();
      const instance = { $id: 'test-1', value: 'TBD' };
      const warnings = validator.checkQuality(instance);
      
      const tbdWarning = warnings.find(w => w.code === 'placeholder_value');
      assert.ok(tbdWarning);
    });

    test('should not warn on valid data', () => {
      const validator = new SemanticValidator();
      const instance = { 
        $id: 'test-1', 
        name: 'Valid Name',
        description: 'A proper description'
      };
      const warnings = validator.checkQuality(instance);
      
      assert.strictEqual(warnings.length, 0);
    });

    test('should check nested fields for placeholders', () => {
      const validator = new SemanticValidator();
      const instance = { 
        $id: 'test-1',
        config: {
          database: 'TODO: configure'
        }
      };
      const warnings = validator.checkQuality(instance);
      
      const todoWarning = warnings.find(w => w.code === 'placeholder_value');
      assert.ok(todoWarning);
      assert.match(todoWarning.path, /config/);
    });

    test('should detect empty description field', () => {
      const validator = new SemanticValidator();
      const instance = { $id: 'test-1', description: '' };
      const warnings = validator.checkQuality(instance);
      
      const emptyWarning = warnings.find(w => w.code === 'empty_field');
      assert.ok(emptyWarning);
      assert.match(emptyWarning.message, /description.*empty/i);
    });
  });

  describe('validateInstance', () => {
    test('should return warnings with instance context', () => {
      const validator = new SemanticValidator();
      const instance = { 
        $id: 'test-instance',
        name: '',
        description: 'TODO: write'
      };
      const warnings = validator.validateInstance(instance);
      
      assert.ok(warnings.length > 0);
      assert.ok(warnings.every(w => w.instance === 'test-instance'));
      assert.ok(warnings.every(w => w.level === 'warning'));
    });

    test('should handle instances without issues', () => {
      const validator = new SemanticValidator();
      const instance = { 
        $id: 'test-instance',
        name: 'Good Name',
        description: 'Good description'
      };
      const warnings = validator.validateInstance(instance);
      
      assert.strictEqual(warnings.length, 0);
    });

    test('should detect multiple issues in one instance', () => {
      const validator = new SemanticValidator();
      const instance = { 
        $id: 'test-instance',
        name: '',
        description: 'TODO: write',
        notes: 'FIXME: review'
      };
      const warnings = validator.validateInstance(instance);
      
      assert.ok(warnings.length >= 3); // empty name + 2 placeholders
      const codes = warnings.map(w => w.code);
      assert.ok(codes.includes('empty_field'));
      assert.ok(codes.includes('placeholder_value'));
    });
  });
});
