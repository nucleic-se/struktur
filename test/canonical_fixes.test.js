/**
 * Tests for canonical.js correctness fixes
 * - Deep merge instance defaults (not shallow)
 * - $classes_by_id returns resolved class objects (not ID arrays)
 * - Classless instances filtered from canonical
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateCanonical, generateCanonicalWithValidation } from '../src/canonical.js';
import { ClassLoader } from '../src/class_loader.js';
import { AspectLoader } from '../src/aspect_loader.js';
import { ClassResolver } from '../src/class_resolver.js';
import { MultiPassValidator } from '../src/validator.js';

describe('Canonical Deep Merge', () => {
  it('should preserve nested defaults when instance provides partial object', async () => {
    const classLoader = new ClassLoader();
    
    // Parent with nested defaults
    const baseDef = {
      $class: 'base',
      $schema: { type: 'object' },
      $fields: {
        config: {
          logging: {
            level: 'info',
            format: 'json'
          },
          timeout: 30
        }
      }
    };
    classLoader.classes.set('base', baseDef);
    
    // Child overrides one nested field
    const appDef = {
      $class: 'app',
      $parent: ['base'],
      $schema: { type: 'object' },
      $fields: {}
    };
    classLoader.classes.set('app', appDef);
    
    const resolver = new ClassResolver(classLoader);
    
    // Instance only provides partial config.logging
    const instances = [{
      $id: 'myapp',
      $class: 'app',
      config: {
        logging: {
          level: 'debug'  // Override level, should preserve format
        }
      }
    }];
    
    const canonical = generateCanonical(instances, resolver);
    const merged = canonical.$instances[0];
    
    // Should have deep merged: level from instance, format from defaults
    assert.strictEqual(merged.config.logging.level, 'debug', 'Instance value should win');
    assert.strictEqual(merged.config.logging.format, 'json', 'Default nested value should be preserved');
    assert.strictEqual(merged.config.timeout, 30, 'Other default values should be preserved');
  });

  it('should handle multi-level nested object merging', async () => {
    const classLoader = new ClassLoader();
    
    const serviceDef = {
      $class: 'service',
      $schema: { type: 'object' },
      $fields: {
        deployment: {
          kubernetes: {
            replicas: 3,
            resources: {
              limits: { cpu: '1', memory: '512Mi' },
              requests: { cpu: '100m', memory: '128Mi' }
            }
          }
        }
      }
    };
    classLoader.classes.set('service', serviceDef);
    
    const resolver = new ClassResolver(classLoader);
    
    const instances = [{
      $id: 'api',
      $class: 'service',
      deployment: {
        kubernetes: {
          resources: {
            limits: { memory: '1Gi' }  // Override only memory limit
          }
        }
      }
    }];
    
    const canonical = generateCanonical(instances, resolver);
    const merged = canonical.$instances[0];
    
    assert.strictEqual(merged.deployment.kubernetes.replicas, 3, 'Top-level default preserved');
    assert.strictEqual(merged.deployment.kubernetes.resources.limits.cpu, '1', 'Nested default CPU preserved');
    assert.strictEqual(merged.deployment.kubernetes.resources.limits.memory, '1Gi', 'Override applied');
    assert.strictEqual(merged.deployment.kubernetes.resources.requests.cpu, '100m', 'Deep nested default preserved');
  });
});

describe('Canonical $classes_by_id Format', () => {
  it('should return resolved class objects, not ID arrays', async () => {
    const classLoader = new ClassLoader();
    
    classLoader.classes.set('entity_base', {
      $class: 'entity_base',
      $schema: { type: 'object' }
    });
    
    classLoader.classes.set('container', {
      $class: 'container',
      $parent: ['entity_base'],
      $kinds: ['docker_container'],
      $pretty_name: 'Container',
      $schema: { type: 'object' }
    });
    
    const resolver = new ClassResolver(classLoader);
    
    const instances = [
      { $id: 'nginx', $class: 'container' },
      { $id: 'redis', $class: 'container' }
    ];
    
    const canonical = generateCanonical(instances, resolver, { includeClassIndex: true });
    
    // Should be an object with class metadata, not array of IDs
    assert.ok(canonical.$classes_by_id.container, 'Should have container class entry');
    assert.strictEqual(typeof canonical.$classes_by_id.container, 'object', 'Should be object, not array');
    assert.strictEqual(canonical.$classes_by_id.container.$class, 'container', 'Should have class name');
    assert.ok(Array.isArray(canonical.$classes_by_id.container.$lineage), 'Should have lineage array');
    assert.strictEqual(canonical.$classes_by_id.container.$pretty_name, 'Container', 'Should have pretty_name');
    assert.ok(Array.isArray(canonical.$classes_by_id.container.$uses_aspects), 'Should have uses_aspects array');
  });

  it('should include all resolved class metadata', async () => {
    const classLoader = new ClassLoader();
    
    classLoader.classes.set('base', {
      $class: 'base',
      $schema: { type: 'object' }
    });
    
    classLoader.classes.set('app', {
      $class: 'app',
      $parent: ['base'],
      $uses_aspects: ['aspect_web_app'],
      $pretty_name: 'Application',
      $domains: ['frontend'],
      $schema: { type: 'object' },
      $fields: { port: 8080 }
    });
    
    const resolver = new ClassResolver(classLoader);
    const instances = [{ $id: 'myapp', $class: 'app' }];
    
    const canonical = generateCanonical(instances, resolver, { includeClassIndex: true });
    const appClass = canonical.$classes_by_id.app;
    
    assert.strictEqual(appClass.$class, 'app');
    assert.ok(Array.isArray(appClass.$lineage), 'Should have lineage array');
    assert.ok(appClass.$lineage.includes('base'), 'Lineage should include base');
    assert.ok(appClass.$lineage.includes('app'), 'Lineage should include app');
    assert.ok(Array.isArray(appClass.$uses_aspects), 'Should have uses_aspects array');
    assert.ok(appClass.$uses_aspects.includes('aspect_web_app'), 'Should include web_app aspect');
    assert.strictEqual(appClass.$pretty_name, 'Application');
    assert.ok(Array.isArray(appClass.$domains), 'Should have domains array');
    assert.ok(appClass.$domains.includes('frontend'), 'Should include frontend domain');
    assert.ok(appClass.$fields, 'Should include merged fields');
    assert.strictEqual(appClass.$fields.port, 8080);
  });
});

describe('Classless Instance Handling', () => {
  it('should filter out instances without class field from canonical', async () => {
    const classLoader = new ClassLoader();
    const aspectLoader = new AspectLoader();
    const resolver = new ClassResolver(classLoader);
    const validator = new MultiPassValidator();
    
    classLoader.classes.set('container', {
      $class: 'container',
      $schema: { 
        type: 'object',
        required: ['$id', '$class'],
        properties: {
          $id: { type: 'string' },
          $class: { type: 'string' }
        }
      }
    });
    
    // Create struktur object with proper validate method
    const struktur = {
      classLoader,
      aspectLoader,
      classResolver: resolver,
      validator,
      validate(instances) {
        const resolved = new Map();
        for (const instance of instances) {
          if (!resolved.has(instance.$class)) {
            const resolvedClass = resolver.resolve(instance.$class);
            validator.registerClass(resolvedClass);
            resolved.set(instance.$class, resolvedClass);
          }
        }
        return validator.validateBatch(instances, (className) => {
          return resolved.get(className) || resolver.resolve(className);
        });
      }
    };
    
    const instances = [
      { $id: 'nginx', $class: 'container' },           // Valid
      { $id: 'global', config: 'data' },              // No class (global config)
      { $id: 'metadata', random: 'stuff' },           // No class (junk)
      { $id: 'redis', $class: 'container' }            // Valid
    ];
    
    const canonical = generateCanonicalWithValidation(instances, struktur, { preserveGlobal: false });
    
    // Should only have instances with class field
    assert.strictEqual(canonical.$instances.length, 2, 'Should only include instances with class field');
    assert.ok(canonical.$instances.every(obj => obj.$class), 'All objects should have class field');
    assert.ok(canonical.$instances.find(obj => obj.$id === 'nginx'), 'Should include nginx');
    assert.ok(canonical.$instances.find(obj => obj.$id === 'redis'), 'Should include redis');
    assert.ok(!canonical.$instances.find(obj => obj.$id === 'global'), 'Should exclude global');
    assert.ok(!canonical.$instances.find(obj => obj.$id === 'metadata'), 'Should exclude metadata');
  });

  it('should require all instances including global to have a class', async () => {
    const classLoader = new ClassLoader();
    const aspectLoader = new AspectLoader();
    const resolver = new ClassResolver(classLoader);
    const validator = new MultiPassValidator();
    
    classLoader.classes.set('container', {
      $class: 'container',
      $schema: { type: 'object' }
    });
    
    // Create struktur object with proper validate method
    const struktur = {
      classLoader,
      aspectLoader,
      classResolver: resolver,
      validator,
      validate(instances) {
        const resolved = new Map();
        for (const instance of instances) {
          if (!resolved.has(instance.$class)) {
            const resolvedClass = resolver.resolve(instance.$class);
            validator.registerClass(resolvedClass);
            resolved.set(instance.$class, resolvedClass);
          }
        }
        return validator.validateBatch(instances, (className) => {
          return resolved.get(className) || resolver.resolve(className);
        });
      }
    };
    
    classLoader.classes.set('global', {
      $class: 'global',
      $schema: { 
        type: 'object',
        properties: {
          build: { type: 'array' }
        }
      }
    });
    
    const instances = [
      { $id: 'global', $class: 'global', build: [{ 'index.html.hbs': 'index.html' }] },
      { $id: 'app', $class: 'container' }
    ];
    
    const canonical = generateCanonicalWithValidation(instances, struktur);
    
    // All instances including global must have class
    assert.strictEqual(canonical.$instances.length, 2, 'Should have 2 objects');
    assert.ok(canonical.$instances.find(obj => obj.$id === 'global' && obj.$class === 'global'), 'Global must have class');
    assert.ok(canonical.$instances.find(obj => obj.$id === 'app'), 'Should include regular instances');
  });
});
