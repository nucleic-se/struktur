import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { loadInstancesFromDir } from '../src/instance_loader.js';
import { buildStack } from '../src/build.js';

describe('$render format validation', () => {
  it('should reject non-array $render in instances', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-render-test-'));
    const instancesDir = path.join(tempDir, 'instances');
    await fs.mkdir(instancesDir, { recursive: true });

    await fs.writeFile(
      path.join(instancesDir, 'bad.json'),
      JSON.stringify({
        $id: 'bad',
        $class: 'page',
        $render: 'page.hbs'
      })
    );

    await assert.rejects(
      async () => loadInstancesFromDir(instancesDir),
      /render must be an array/
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should accept valid {template, output} render tasks', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-render-test-'));
    const instancesDir = path.join(tempDir, 'instances');
    await fs.mkdir(instancesDir, { recursive: true });

    await fs.writeFile(
      path.join(instancesDir, 'ok.json'),
      JSON.stringify({
        $id: 'ok',
        $class: 'page',
        $render: [{ template: 'page.hbs', output: '/page.html' }]
      })
    );

    const { instances } = await loadInstancesFromDir(instancesDir);
    assert.strictEqual(instances.length, 1);
    assert.strictEqual(instances[0].$render.length, 1);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should reject invalid config render tasks', async () => {
    await assert.rejects(
      async () => buildStack({
        classDirs: ['dummy'],
        instanceDirs: ['dummy'],
        renderTasks: [{ template: 'page.hbs' }],
        buildDir: 'build',
        quiet: true
      }),
      /render\[0\]\.output must be a non-empty string/
    );
  });
});
