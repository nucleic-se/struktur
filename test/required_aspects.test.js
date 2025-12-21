/**
 * Tests for required aspect enforcement
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClassLoader } from '../src/class_loader.js';
import { ClassResolver } from '../src/class_resolver.js';
import { AspectLoader } from '../src/aspect_loader.js';
import { MultiPassValidator } from '../src/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Required Aspect Enforcement', () => {
  let classLoader;
  let aspectLoader;
  let resolver;
  let validator;

  beforeEach(async () => {
    classLoader = new ClassLoader();
    aspectLoader = new AspectLoader();
    
    // Load test fixtures
    const classesDir = path.join(__dirname, 'fixtures', 'classes');
    const aspectsDir = path.join(__dirname, 'fixtures', 'aspects');
    
    await classLoader.loadClassesFromDirectory(classesDir);
    await aspectLoader.loadAspectsFromDirectory(aspectsDir);
    
    resolver = new ClassResolver(classLoader);
    validator = new MultiPassValidator();
    
    // Register all aspects
    for (const aspect of aspectLoader.getAllAspects()) {
      validator.registerAspect(aspect);
    }
  });

  describe('ClassResolver._mergeAspects', () => {
    it('should preserve required flag from object format', () => {
      const resolved = resolver.resolve('service');
      
      // service.schema.json has: "$aspects": {"network_interface": {"required": true}}
      assert.strictEqual(typeof resolved.$aspects, 'object');
      assert.strictEqual(Array.isArray(resolved.$aspects), false);
      assert.ok(resolved.$aspects.network_interface);
      assert.strictEqual(resolved.$aspects.network_interface.required, true);
    });

    it('should treat array format as optional', () => {
      // test_array_$aspects.schema.json has array format: ["network_interface"]
      const resolved = resolver.resolve('test_array_aspects');
      
      assert.strictEqual(typeof resolved.$aspects, 'object');
      assert.ok(resolved.$aspects.network_interface);
      assert.strictEqual(resolved.$aspects.network_interface.required, false);
    });

    it('should merge aspects from parent and child', () => {
      // parent_with_aspect has network_interface required=true
      // child_with_aspect has no $aspects defined, should inherit from parent
      const resolved = resolver.resolve('child_with_aspect');
      
      assert.ok(resolved.$aspects.network_interface);
      assert.strictEqual(resolved.$aspects.network_interface.required, true);
    });

    it('should let parent required=true override child required=false', () => {
      // parent_requires has network_interface required=true
      // child_optionalizes has network_interface required=false
      const resolved = resolver.resolve('child_optionalizes');
      
      // Parent wins - aspect should be required
      assert.strictEqual(resolved.$aspects.network_interface.required, true);
    });
  });

  describe('MultiPassValidator with required aspects', () => {
    it('should enforce required aspects', () => {
      const resolved = resolver.resolve('service');
      validator.registerClass(resolved);

      // Instance missing required network_interface aspect
      const instance = {
        id: 'test-service',
        class: 'service',
        port: 8080
      };

      const result = validator.validate(instance, resolved);
      
      assert.strictEqual(result.valid, false);
      const aspectError = result.errors.find(e => e.code === 'missing_required_aspect');
      assert.ok(aspectError, 'Should have missing_required_aspect error');
      assert.strictEqual(aspectError.aspect, 'network_interface');
    });

    it('should pass when required aspect is provided', () => {
      const resolved = resolver.resolve('service');
      validator.registerClass(resolved);

      // Instance with required network_interface aspect
      const instance = {
        id: 'test-service',
        class: 'service',
        port: 8080,
        $aspects: {
          network_interface: {
            ip: '192.168.1.100'
          }
        }
      };

      const result = validator.validate(instance, resolved);
      
      if (!result.valid) {
        console.error('Validation errors:', JSON.stringify(result.errors, null, 2));
      }
      assert.strictEqual(result.valid, true);
    });

    it('should not enforce optional aspects', () => {
      // optional_service has network_interface required=false
      const resolved = resolver.resolve('optional_service');
      validator.registerClass(resolved);

      // Instance without optional aspect - should be valid
      const instance = {
        id: 'test-optional',
        class: 'optional_service'
      };

      const result = validator.validate(instance, resolved);
      assert.strictEqual(result.valid, true);
    });

    it('should validate aspect data when optional aspect is provided', () => {
      // optional_service2 has network_interface required=false
      const resolved = resolver.resolve('optional_service2');
      validator.registerClass(resolved);

      // Instance with invalid aspect data (missing required 'ip')
      const instance = {
        id: 'test-optional',
        class: 'optional_service2',
        $aspects: {
          network_interface: {
            hostname: 'test.local'
            // missing required 'ip' field
          }
        }
      };

      const result = validator.validate(instance, resolved);
      
      // Should fail because aspect data is invalid
      assert.strictEqual(result.valid, false);
      const aspectError = result.errors.find(e => e.layer === 'aspect:network_interface');
      assert.ok(aspectError, 'Should have aspect validation error');
    });
  });
});
