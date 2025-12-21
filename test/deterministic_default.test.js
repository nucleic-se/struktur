import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStack } from '../src/build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'skribe');

describe('Deterministic Build Defaults', () => {
  it('should use hash-based build directory by default', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-build-'));
    const buildRoot = path.join(tempDir, 'build');

    const result = await buildStack({
      classDirs: [path.join(FIXTURES_DIR, 'classes')],
      instanceDirs: [path.join(FIXTURES_DIR, 'instances')],
      buildDir: buildRoot,
      quiet: true
    });

    assert.ok(path.basename(result.buildDir).startsWith('build-'));
    assert.ok(result.buildDir.startsWith(buildRoot));

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should allow opt-out with deterministic: false', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-build-'));
    const buildRoot = path.join(tempDir, 'build');

    const result = await buildStack({
      classDirs: [path.join(FIXTURES_DIR, 'classes')],
      instanceDirs: [path.join(FIXTURES_DIR, 'instances')],
      buildDir: buildRoot,
      deterministic: false,
      quiet: true
    });

    assert.strictEqual(result.buildDir, buildRoot);

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
