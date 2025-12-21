import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { buildStack } from '../src/build.js';
import { loadInstancesFromDir } from '../src/instance_loader.js';
import { ClassLoader } from '../src/class_loader.js';

describe('Strictness upgrades', () => {
  it('should throw on unresolved class during canonical generation', async () => {
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

  it('should throw on invalid JSON in instance files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-invalid-json-'));
    const instancesDir = path.join(tempDir, 'instances');
    await fs.mkdir(instancesDir, { recursive: true });

    await fs.writeFile(path.join(instancesDir, 'bad.json'), '{ bad json');

    await assert.rejects(
      async () => loadInstancesFromDir(instancesDir),
      /Failed to parse instance file/i
    );

    await fs.rm(tempDir, { recursive: true, force: true });
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
      /Class directory not found/i
    );
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
