/**
 * Strictness Upgrades Tests (v0.4.0)
 * 
 * Tests for strict-by-default error handling:
 * 1. Unsafe output paths (path traversal prevention)
 * 2. Unresolved classes in canonical generation
 * 3. Missing $id in instances
 * 4. Invalid JSON in instance files
 * 5. Missing buildDir in template helpers
 * 6. Explicit vs default directory handling
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { buildStack } from '../src/build.js';
import { loadInstancesFromDir } from '../src/instance_loader.js';
import { ClassLoader } from '../src/class_loader.js';
import { AspectLoader } from '../src/aspect_loader.js';
import { resolveOutputPath } from '../src/template_helpers/engine/index.js';
import { generateCanonical } from '../src/canonical.js';
import { ClassResolver } from '../src/class_resolver.js';

describe('Strictness Upgrades (v0.4.0)', () => {
  describe('1. Unsafe Output Paths', () => {
    it('should throw on path traversal attempts (../ style)', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-path-'));
      const buildDir = path.join(tempDir, 'build');
      const templateKey = 'test.html';
      
      assert.throws(
        () => resolveOutputPath(templateKey, '../../etc/passwd', buildDir),
        (error) => {
          return error.message.includes('Security: Unsafe output path detected') &&
                 error.message.includes('Path escapes build directory');
        }
      );
      
      await fs.rm(tempDir, { recursive: true, force: true });
    });
    
    it('should throw on absolute paths outside build dir', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-path-'));
      const buildDir = path.join(tempDir, 'deep', 'nested', 'build');
      const templateKey = 'test.html';
      
      // Path that goes up enough levels to escape
      assert.throws(
        () => resolveOutputPath(templateKey, '../../../../../etc/passwd', buildDir),
        (error) => {
          return error.message.includes('Security: Unsafe output path detected') &&
                 error.message.includes('Path escapes build directory');
        }
      );
      
      await fs.rm(tempDir, { recursive: true, force: true });
    });
    
    it('should allow safe relative paths within build dir', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-path-'));
      const buildDir = path.join(tempDir, 'build');
      const templateKey = 'test.html';
      
      const resolved = resolveOutputPath(templateKey, 'output/file.txt', buildDir);
      assert.ok(resolved.startsWith(path.resolve(buildDir)));
      
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('2. Unresolved Classes in Canonical', () => {
    it('should throw on unresolved class during build', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-unresolved-'));
      const instancesDir = path.join(tempDir, 'instances');
      await fs.mkdir(instancesDir, { recursive: true });

      await fs.writeFile(
        path.join(instancesDir, 'bad.json'),
        JSON.stringify({ $id: 'missing', $class: 'does_not_exist' })
      );

      await assert.rejects(
        async () => {
          await buildStack({
            classDirs: [],
            instanceDirs: [instancesDir],
            buildDir: path.join(tempDir, 'build'),
            quiet: true
          });
        },
        /unresolved class/i
      );

      await fs.rm(tempDir, { recursive: true, force: true });
    });
    
    it('should show available classes in error message', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-unresolved-'));
      const classesDir = path.join(tempDir, 'classes');
      await fs.mkdir(classesDir, { recursive: true });
      
      // Create one valid class
      await fs.writeFile(
        path.join(classesDir, 'valid.class.json'),
        JSON.stringify({
          $class: 'valid_class',
          $schema: {
            type: 'object',
            properties: { $id: { type: 'string' }, $class: { type: 'string' } },
            required: ['$id', '$class']
          }
        })
      );
      
      const loader = new ClassLoader();
      await loader.loadClassesFromDirectory(classesDir);
      const resolver = new ClassResolver(loader);
      
      const instances = [{ $id: 'test', $class: 'missing_class' }];
      
      assert.throws(
        () => generateCanonical(instances, resolver),
        (error) => {
          return error.message.includes('Available classes:') &&
                 error.message.includes('valid_class');
        }
      );
      
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('3. Missing $id in Instances', () => {
    it('should throw when instance file missing $id', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-missing-id-'));
      const instancesDir = path.join(tempDir, 'instances');
      await fs.mkdir(instancesDir, { recursive: true });
      
      await fs.writeFile(
        path.join(instancesDir, 'bad.json'),
        JSON.stringify({ $class: 'test_class', name: 'Test' })
      );
      
      await assert.rejects(
        async () => loadInstancesFromDir(instancesDir),
        /Instance missing required \$id field/
      );
      
      await fs.rm(tempDir, { recursive: true, force: true });
    });
    
    it('should throw when $id is empty string', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-empty-id-'));
      const instancesDir = path.join(tempDir, 'instances');
      await fs.mkdir(instancesDir, { recursive: true });
      
      await fs.writeFile(
        path.join(instancesDir, 'bad.json'),
        JSON.stringify({ $id: '', $class: 'test_class' })
      );
      
      await assert.rejects(
        async () => loadInstancesFromDir(instancesDir),
        /Instance missing required \$id field/
      );
      
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('4. Invalid JSON in Instance Files', () => {
    it('should throw on malformed JSON with helpful message', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-invalid-json-'));
      const instancesDir = path.join(tempDir, 'instances');
      await fs.mkdir(instancesDir, { recursive: true });

      await fs.writeFile(path.join(instancesDir, 'bad.json'), '{ bad json');

      await assert.rejects(
        async () => loadInstancesFromDir(instancesDir),
        /Failed to parse instance file/
      );

      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('5. Missing buildDir in Template Helpers', () => {
    it('should throw when resolveOutputPath called without buildDir', () => {
      assert.throws(
        () => resolveOutputPath('test.html', 'output.txt', null),
        /Invalid output path resolution request/
      );
    });
    
    it('should throw when resolveOutputPath called without outputPath', () => {
      assert.throws(
        () => resolveOutputPath('test.html', null, '/build'),
        /Invalid output path resolution request/
      );
    });
  });

  describe('6. Explicit vs Default Directory Handling', () => {
    it('should throw when explicitly-configured class directory missing', async () => {
      const loader = new ClassLoader();
      
      await assert.rejects(
        async () => await loader.loadClassesFromDirectory({ 
          path: path.join(os.tmpdir(), 'missing-explicit'), 
          explicit: true 
        }),
        (error) => {
          return error.message.includes('Class directory not found') &&
                 error.message.includes('explicitly configured');
        }
      );
    });
    
    it('should NOT throw when default class directory missing', async () => {
      const loader = new ClassLoader();
      
      // Should not throw, just return empty array
      const classes = await loader.loadClassesFromDirectory({ 
        path: path.join(os.tmpdir(), 'missing-default'), 
        explicit: false 
      });
      
      assert.strictEqual(classes.length, 0);
    });
    
    it('should throw when explicitly-configured instance directory missing', async () => {
      await assert.rejects(
        async () => await loadInstancesFromDir({ 
          path: path.join(os.tmpdir(), 'missing-explicit'), 
          explicit: true 
        }),
        (error) => {
          return error.message.includes('Instance directory not found') &&
                 error.message.includes('explicitly configured');
        }
      );
    });
    
    it('should NOT throw when default instance directory missing', async () => {
      // Should not throw, just return empty result
      const result = await loadInstancesFromDir({ 
        path: path.join(os.tmpdir(), 'missing-default'), 
        explicit: false 
      });
      
      assert.strictEqual(result.instances.length, 0);
    });
    
    it('should throw when explicitly-configured aspect directory missing', async () => {
      const loader = new AspectLoader();
      
      await assert.rejects(
        async () => await loader.loadAspectsFromDirectory({ 
          path: path.join(os.tmpdir(), 'missing-explicit'), 
          explicit: true 
        }),
        (error) => {
          return error.message.includes('Aspect directory not found') &&
                 error.message.includes('explicitly configured');
        }
      );
    });
    
    it('should NOT throw when default aspect directory missing', async () => {
      const loader = new AspectLoader();
      
      // Should not throw, just return empty array
      const aspects = await loader.loadAspectsFromDirectory({ 
        path: path.join(os.tmpdir(), 'missing-default'), 
        explicit: false 
      });
      
      assert.strictEqual(aspects.length, 0);
    });
    
    it('should support template-only projects (empty classDirs)', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-template-only-'));
      await fs.mkdir(path.join(tempDir, 'templates'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'templates', 'test.txt'),
        'Hello World'
      );
      
      // Should not throw with empty classDirs
      await assert.doesNotReject(async () => {
        await buildStack({
          classDirs: [],  // Explicitly no classes
          instanceDirs: [],
          aspectDirs: [],
          templateDirs: [{ path: path.join(tempDir, 'templates'), explicit: true }],
          buildDir: path.join(tempDir, 'build'),
          quiet: true,
          deterministic: false
        });
      });
      
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  it('should throw on instances missing $id', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-missing-id-'));
    const instancesDir = path.join(tempDir, 'instances');
    await fs.mkdir(instancesDir, { recursive: true });

    await fs.writeFile(
      path.join(instancesDir, 'bad.json'),
      JSON.stringify({ $class: 'server' })
    );

    await assert.rejects(
      async () => loadInstancesFromDir(instancesDir),
      /missing required \$id/i
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should throw on missing explicitly-configured class directory', async () => {
    await assert.rejects(
      async () => {
        await buildStack({
          classDirs: [path.join(os.tmpdir(), 'does-not-exist')],
          instanceDirs: [],
          buildDir: path.join(os.tmpdir(), 'build-explicit-missing'),
          quiet: true
        });
      },
      /Classes directory not found/i
    );
  });

  it('should skip missing default directories silently', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-missing-defaults-'));
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const result = await buildStack({
        buildDir: path.join(tempDir, 'build'),
        quiet: true
      });
      await fs.access(result.buildDir);
    } finally {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should throw when buildDir is missing', async () => {
    await assert.rejects(
      async () => {
        await buildStack({
          classDirs: [],
          instanceDirs: [],
          buildDir: '',
          quiet: true
        });
      },
      /buildDir must be a non-empty string/i
    );
  });

  it('should detect output-file collisions', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-collision-'));
    const classesDir = path.join(tempDir, 'classes');
    const instancesDir = path.join(tempDir, 'instances');
    const templatesDir = path.join(tempDir, 'templates');
    await fs.mkdir(classesDir, { recursive: true });
    await fs.mkdir(instancesDir, { recursive: true });
    await fs.mkdir(templatesDir, { recursive: true });

    await fs.writeFile(
      path.join(classesDir, 'page.class.json'),
      JSON.stringify({
        $class: 'page',
        $schema: { type: 'object', properties: { $id: { type: 'string' } } }
      })
    );

    await fs.writeFile(
      path.join(instancesDir, 'page.json'),
      JSON.stringify({ $id: 'page-1', $class: 'page' })
    );

    await fs.writeFile(
      path.join(templatesDir, 'page.hbs'),
      '<p>test</p>'
    );

    await assert.rejects(
      async () => {
        await buildStack({
          classDirs: [classesDir],
          instanceDirs: [instancesDir],
          templateDirs: [templatesDir],
          renderTasks: [
            { template: 'page.hbs', output: 'index.html' },
            { template: 'page.hbs', output: 'index.html' }
          ],
          buildDir: path.join(tempDir, 'build'),
          quiet: true
        });
      },
      /Output file collision/i
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should reject undeclared aspect usage', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-aspect-'));
    const classesDir = path.join(tempDir, 'classes');
    const instancesDir = path.join(tempDir, 'instances');
    await fs.mkdir(classesDir, { recursive: true });
    await fs.mkdir(instancesDir, { recursive: true });

    await fs.writeFile(
      path.join(classesDir, 'server.class.json'),
      JSON.stringify({
        $class: 'server',
        $uses_aspects: [],
        $schema: { type: 'object', properties: { $id: { type: 'string' } } }
      })
    );

    await fs.writeFile(
      path.join(instancesDir, 'server.json'),
      JSON.stringify({
        $id: 'server-1',
        $class: 'server',
        $aspects: { aspect_network: {} }
      })
    );

    await assert.rejects(
      async () => {
        await buildStack({
          classDirs: [classesDir],
          instanceDirs: [instancesDir],
          buildDir: path.join(tempDir, 'build'),
          quiet: true
        });
      },
      /undeclared aspect/i
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should allow aspects declared in parent class', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-inherited-aspect-'));
    const classesDir = path.join(tempDir, 'classes');
    const instancesDir = path.join(tempDir, 'instances');
    await fs.mkdir(classesDir, { recursive: true });
    await fs.mkdir(instancesDir, { recursive: true });

    // Parent class declares aspect
    await fs.writeFile(
      path.join(classesDir, 'base.class.json'),
      JSON.stringify({
        $class: 'base',
        $uses_aspects: ['aspect_network'],
        $schema: { type: 'object', properties: { $id: { type: 'string' } } }
      })
    );

    // Child class inherits aspect declaration
    await fs.writeFile(
      path.join(classesDir, 'server.class.json'),
      JSON.stringify({
        $class: 'server',
        $parent: 'base',
        $schema: { type: 'object', properties: { $id: { type: 'string' } } }
      })
    );

    // Instance uses inherited aspect
    await fs.writeFile(
      path.join(instancesDir, 'server.json'),
      JSON.stringify({
        $id: 'server-1',
        $class: 'server',
        $aspects: { aspect_network: { ip: '10.0.0.1' } }
      })
    );

    // Should succeed (aspect declared in parent)
    await buildStack({
      classDirs: [classesDir],
      instanceDirs: [instancesDir],
      buildDir: path.join(tempDir, 'build'),
      quiet: true
    });

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should reject legacy $aspects array format in classes', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-legacy-aspects-'));
    const classesDir = path.join(tempDir, 'classes');
    await fs.mkdir(classesDir, { recursive: true });

    await fs.writeFile(
      path.join(classesDir, 'legacy.class.json'),
      JSON.stringify({
        $class: 'legacy',
        $schema: { type: 'object', properties: { $id: { type: 'string' } } },
        $aspects: ['aspect_network']
      })
    );

    const loader = new ClassLoader();
    await assert.rejects(
      async () => {
        await loader.loadClassesFromDirectory(classesDir);
      },
      /legacy \$aspects array format/i
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should enforce AJV strict required rules', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-strict-ajv-'));
    const classesDir = path.join(tempDir, 'classes');
    await fs.mkdir(classesDir, { recursive: true });

    await fs.writeFile(
      path.join(classesDir, 'invalid.class.json'),
      JSON.stringify({
        $class: 'invalid',
        $schema: {
          type: 'object',
          required: ['missing_property'],
          properties: { $id: { type: 'string' } }
        }
      })
    );

    const loader = new ClassLoader();
    await assert.rejects(
      async () => {
        await loader.loadClassesFromDirectory(classesDir);
      },
      /Invalid JSON Schema/i
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
