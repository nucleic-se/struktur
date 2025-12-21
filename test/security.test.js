/**
 * Security tests for Struktur v2
 * Tests for path traversal, schema validation, and other security concerns
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildStack } from '../src/build.js';
import { ClassLoader } from '../src/class_loader.js';
import { AspectLoader } from '../src/aspect_loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Security Tests', () => {
  const testDir = path.join(__dirname, 'fixtures', 'security');
  const buildDir = path.join(testDir, 'build');
  const resetDirs = async () => {
    await fs.rm(path.join(testDir, 'classes'), { recursive: true, force: true });
    await fs.rm(path.join(testDir, 'instances'), { recursive: true, force: true });
    await fs.rm(path.join(testDir, 'templates'), { recursive: true, force: true });
    await fs.mkdir(path.join(testDir, 'classes'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'instances'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
  };

  before(async () => {
    // Create test directories
    await fs.mkdir(path.join(testDir, 'classes'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'instances'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
  });

  after(async () => {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Path Traversal Prevention', () => {
    it('should reject path traversal in render output paths', async () => {
      await resetDirs();
      // Create test files
      await fs.writeFile(
        path.join(testDir, 'classes', 'test.class.json'),
        JSON.stringify({
          $class: 'test',
          $schema: {
            type: 'object',
            properties: { $id: { type: 'string' } }
          }
        })
      );

      // Create malicious instance with path traversal in $render output
      await fs.writeFile(
        path.join(testDir, 'instances', 'global.json'),
        JSON.stringify({
          $id: 'global',
          $class: 'test',
          $render: [
            { template: 'test.html', output: '../../../etc/passwd' }
          ]
        })
      );

      await fs.writeFile(
        path.join(testDir, 'templates', 'test.html'),
        'malicious content'
      );

      // Attempt build - should reject path traversal
      await assert.rejects(
        async () => {
          await buildStack({
            classDirs: [path.join(testDir, 'classes')],
            instanceDirs: [path.join(testDir, 'instances')],
            templateDirs: [path.join(testDir, 'templates')],
            buildDir,
            quiet: true
          });
        },
        /Unsafe output path|path traversal/i,
        'Should reject unsafe output path'
      );

    });

    it('should reject path traversal in canonical.json path', async () => {
      await resetDirs();
      // Create test files
      await fs.writeFile(
        path.join(testDir, 'classes', 'test.class.json'),
        JSON.stringify({
          $class: 'test',
          $schema: { type: 'object', properties: { $id: { type: 'string' } } }
        })
      );

      await fs.writeFile(
        path.join(testDir, 'instances', 'test1.json'),
        JSON.stringify({ $id: 'test1', $class: 'test' })
      );

      // Build should complete without escaping buildDir
      const result = await buildStack({
        classDirs: [path.join(testDir, 'classes')],
        instanceDirs: [path.join(testDir, 'instances')],
        buildDir,
        quiet: true
      });

      // Verify canonical.json is inside build dir
      const canonicalPath = path.join(result.buildDir, 'canonical.json');
      const canonicalExists = await fs.access(canonicalPath).then(() => true).catch(() => false);
      assert.ok(canonicalExists, 'canonical.json should exist in build directory');

      // Verify no canonical.json outside build dir
      const parentDir = path.dirname(result.buildDir);
      const parentCanonical = path.join(parentDir, 'canonical.json');
      const parentExists = await fs.access(parentCanonical).then(() => true).catch(() => false);
      assert.ok(!parentExists, 'canonical.json should not exist outside build directory');
    });

    it('should reject path traversal in meta/ directory writes', async () => {
      await resetDirs();
      // Create test class with path traversal in class name (stored safely but name is malicious)
      await fs.writeFile(
        path.join(testDir, 'classes', 'malicious.class.json'),
        JSON.stringify({
          $class: '../../../tmp/malicious',  // Malicious class name
          $schema: { type: 'object', properties: { $id: { type: 'string' } } }
        })
      );

      await fs.writeFile(
        path.join(testDir, 'instances', 'test1.json'),
        JSON.stringify({ $id: 'test1', $class: '../../../tmp/malicious' })
      );

      // Build should reject unsafe meta path
      await assert.rejects(
        async () => {
          await buildStack({
            classDirs: [path.join(testDir, 'classes')],
            instanceDirs: [path.join(testDir, 'instances')],
            buildDir,
            quiet: true
          });
        },
        /Unsafe output path|path traversal/i,
        'Should reject unsafe class output path'
      );

      // Verify nothing was written to /tmp
      const tmpMalicious = '/tmp/malicious.json';
      const tmpExists = await fs.access(tmpMalicious).then(() => true).catch(() => false);
      assert.ok(!tmpExists, 'Malicious file should not exist in /tmp');
      
      // Verify file was written inside build dir (if at all)
      const buildMeta = path.join(buildDir, 'meta', 'classes');
      const metaFiles = await fs.readdir(buildMeta).catch(() => []);
      // Either no file created, or file created with sanitized name inside buildDir
      const hasEscape = metaFiles.some(f => f.includes('..'));
      assert.ok(!hasEscape, 'Meta directory should not contain path traversal');
    });
  });

  describe('Schema Meta-Validation', () => {
    it('should reject schema with invalid JSON Schema syntax', async () => {
      // Clean directory first
      await fs.rm(path.join(testDir, 'classes'), { recursive: true, force: true });
      await fs.mkdir(path.join(testDir, 'classes'), { recursive: true });
      
      const classLoader = new ClassLoader();
      
      // Create invalid schema (type must be string or array, not number)
      const invalidSchema = {
        $class: 'invalid',
        $schema: {
          type: 123,  // Invalid: type must be string or array
          properties: {
            $id: { type: 'string' }
          }
        }
      };

      const schemaPath = path.join(testDir, 'classes', 'invalid.class.json');
      await fs.writeFile(schemaPath, JSON.stringify(invalidSchema));

      // Should throw error on load due to meta-validation
      await assert.rejects(
        async () => {
          await classLoader.loadClassesFromDirectory(path.join(testDir, 'classes'));
        },
        /Invalid JSON Schema/i,
        'Should reject invalid schema'
      );
      
      // Clean up after test
      await fs.rm(path.join(testDir, 'classes'), { recursive: true, force: true });
    });

    it('should reject aspect with invalid JSON Schema syntax', async () => {
      // Clean directory first
      const aspectDir = path.join(testDir, 'aspects');
      await fs.rm(aspectDir, { recursive: true, force: true });
      await fs.mkdir(aspectDir, { recursive: true });
      
      const aspectLoader = new AspectLoader();
      
      // Create invalid aspect schema
      const invalidAspect = {
        $class: 'invalid',
        $aspect: 'invalid',
        description: 'Invalid aspect',
        $schema: {
          // Invalid: properties without type: object
          properties: {
            config: { type: 'notarealtype' }
          }
        }
      };

      await fs.writeFile(
        path.join(aspectDir, 'invalid.class.json'),
        JSON.stringify(invalidAspect)
      );

      // Should throw error on load due to meta-validation
      await assert.rejects(
        async () => {
          await aspectLoader.loadAspectsFromDirectory(aspectDir);
        },
        /Invalid JSON Schema|Failed to load aspect/i,
        'Should reject invalid aspect schema'
      );
      
      // Clean up after test
      await fs.rm(aspectDir, { recursive: true, force: true });
    });

    it('should accept valid JSON Schema', async () => {
      // Clean directory first
      await fs.rm(path.join(testDir, 'classes'), { recursive: true, force: true });
      await fs.mkdir(path.join(testDir, 'classes'), { recursive: true });
      
      const classLoader = new ClassLoader();
      
      // Create valid schema
      const validSchema = {
        $class: 'valid',
        $schema: {
          type: 'object',
          properties: {
            $id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['$id']
        }
      };

      const schemaPath = path.join(testDir, 'classes', 'valid.class.json');
      await fs.writeFile(schemaPath, JSON.stringify(validSchema));

      // Should load successfully
      await classLoader.loadClassesFromDirectory(path.join(testDir, 'classes'));
      assert.ok(classLoader.classes.has('valid'), 'Valid schema should load');
    });
  });

  describe('Validation Bypass Prevention', () => {
    it('should validate instances with class field', async () => {
      // Clean directories first
      await fs.rm(path.join(testDir, 'classes'), { recursive: true, force: true });
      await fs.rm(path.join(testDir, 'instances'), { recursive: true, force: true });
      await fs.mkdir(path.join(testDir, 'classes'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'instances'), { recursive: true });
      
      // Create test schema
      await fs.writeFile(
        path.join(testDir, 'classes', 'validated.class.json'),
        JSON.stringify({
          $class: 'validated',
          $schema: {
            type: 'object',
            properties: {
              $id: { type: 'string' },
              required_field: { type: 'string' }
            },
            required: ['$id', 'required_field']
          }
        })
      );

      // Create invalid instance (missing required field)
      await fs.writeFile(
        path.join(testDir, 'instances', 'invalid.json'),
        JSON.stringify({ $id: 'invalid', $class: 'validated' })
      );

      // Build should fail validation
      await assert.rejects(
        async () => {
          await buildStack({
            classDirs: [path.join(testDir, 'classes')],
            instanceDirs: [path.join(testDir, 'instances')],
            buildDir,
            quiet: true
          });
        },
        /Validation failed/,
        'Should fail validation for invalid instance'
      );
    });

    it('should reject instances without id field', async () => {
      // Clean directories first
      await fs.rm(path.join(testDir, 'classes'), { recursive: true, force: true });
      await fs.rm(path.join(testDir, 'instances'), { recursive: true, force: true });
      await fs.mkdir(path.join(testDir, 'classes'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'instances'), { recursive: true });
      
      // Create valid test class first
      await fs.writeFile(
        path.join(testDir, 'classes', 'test.class.json'),
        JSON.stringify({
          $class: 'test',
          $schema: { type: 'object', properties: { $id: { type: 'string' } } }
        })
      );
      
      // Create instance without id or class
      await fs.writeFile(
        path.join(testDir, 'instances', 'no-id.json'),
        JSON.stringify({ some_field: 'value' })
      );
      
      // Create valid instance to allow build to succeed
      await fs.writeFile(
        path.join(testDir, 'instances', 'valid.json'),
        JSON.stringify({ $id: 'valid1', $class: 'test' })
      );

      // Build should fail on instance without $id
      await assert.rejects(
        async () => {
          await buildStack({
            classDirs: [path.join(testDir, 'classes')],
            instanceDirs: [path.join(testDir, 'instances')],
            buildDir,
            quiet: true
          });
        },
        /missing required \$id/i,
        'Instance without $id should fail the build'
      );
    });
  });
});
