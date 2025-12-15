import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { 
  generateBuildHash, 
  readManifest, 
  writeManifest,
  checkCollision,
  generateDeterministicBuildDir 
} from '../src/utils/build_manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Build Manifest and Deterministic Builds', () => {
  const testDir = path.join(__dirname, 'temp-manifest-test');

  it('should generate consistent hash for same config', () => {
    const config1 = {
      classDirs: ['classes', 'more-classes'],
      aspectDirs: ['aspects'],
      instanceDirs: ['instances'],
      templateDirs: ['templates']
    };
    
    const config2 = {
      classDirs: ['classes', 'more-classes'],
      aspectDirs: ['aspects'],
      instanceDirs: ['instances'],
      templateDirs: ['templates']
    };
    
    const hash1 = generateBuildHash(config1);
    const hash2 = generateBuildHash(config2);
    
    assert.strictEqual(hash1, hash2, 'Same config should produce same hash');
    assert.strictEqual(hash1.length, 8, 'Hash should be 8 characters');
  });

  it('should generate different hash for different configs', () => {
    const config1 = {
      classDirs: ['classes'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    };
    
    const config2 = {
      classDirs: ['classes', 'more-classes'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    };
    
    const hash1 = generateBuildHash(config1);
    const hash2 = generateBuildHash(config2);
    
    assert.notStrictEqual(hash1, hash2, 'Different configs should produce different hashes');
  });

  it('should normalize paths for consistent hashing', () => {
    const config1 = {
      classDirs: ['./classes', './more-classes'],
      aspectDirs: [],
      instanceDirs: ['./instances'],
      templateDirs: []
    };
    
    const config2 = {
      classDirs: ['classes', 'more-classes'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    };
    
    const hash1 = generateBuildHash(config1);
    const hash2 = generateBuildHash(config2);
    
    assert.strictEqual(hash1, hash2, 'Relative vs absolute paths should normalize to same hash');
  });

  it('should write and read manifest', async () => {
    await fs.mkdir(testDir, { recursive: true });
    
    const config = {
      classDirs: ['classes'],
      aspectDirs: ['aspects'],
      instanceDirs: ['instances'],
      templateDirs: ['templates']
    };
    
    const written = await writeManifest(testDir, config);
    const read = await readManifest(testDir);
    
    assert.ok(written, 'Should return written manifest');
    assert.ok(read, 'Should read manifest');
    assert.strictEqual(read.version, '0.2.0-alpha');
    assert.strictEqual(read.hash, written.hash);
    assert.ok(read.timestamp);
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should return null when manifest does not exist', async () => {
    const manifest = await readManifest(path.join(testDir, 'nonexistent'));
    assert.strictEqual(manifest, null);
  });

  it('should detect collision when hashes differ', async () => {
    await fs.mkdir(testDir, { recursive: true });
    
    const config1 = {
      classDirs: ['classes'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    };
    
    const config2 = {
      classDirs: ['classes', 'more'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    };
    
    // Write first manifest
    await writeManifest(testDir, config1);
    
    // Check for collision with different config
    const warnings = [];
    const mockLogger = {
      warn: (msg) => warnings.push(msg)
    };
    
    const result = await checkCollision(testDir, config2, mockLogger);
    
    assert.strictEqual(result.collision, true, 'Should detect collision');
    assert.ok(result.existingManifest, 'Should include existing manifest');
    assert.ok(result.newHash, 'Should include new hash');
    assert.ok(result.warning, 'Should include warning message');
    assert.strictEqual(warnings.length, 1, 'Should log warning');
    assert.ok(warnings[0].includes('collision'), 'Warning should mention collision');
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should not detect collision when hashes match', async () => {
    await fs.mkdir(testDir, { recursive: true });
    
    const config = {
      classDirs: ['classes'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    };
    
    // Write manifest
    await writeManifest(testDir, config);
    
    // Check for collision with same config
    const result = await checkCollision(testDir, config, null);
    
    assert.strictEqual(result.collision, false, 'Should not detect collision');
    assert.strictEqual(result.rebuild, true, 'Should mark as rebuild');
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should not detect collision when no manifest exists', async () => {
    const result = await checkCollision(path.join(testDir, 'nonexistent'), {
      classDirs: ['classes'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    }, null);
    
    assert.strictEqual(result.collision, false, 'Should not detect collision for new builds');
  });

  it('should generate deterministic build directory name', () => {
    const config = {
      classDirs: ['classes'],
      aspectDirs: [],
      instanceDirs: ['instances'],
      templateDirs: []
    };
    
    const buildDir1 = generateDeterministicBuildDir('./build', config);
    const buildDir2 = generateDeterministicBuildDir('./build', config);
    
    assert.strictEqual(buildDir1, buildDir2, 'Should generate same directory name for same config');
    assert.ok(buildDir1.includes('build-'), 'Should include build- prefix');
    assert.ok(path.basename(buildDir1).match(/^build-[a-f0-9]{8}$/), 'Should match pattern build-XXXXXXXX');
  });

  it('should sort directory arrays for consistent hashing', () => {
    const config1 = {
      classDirs: ['b', 'a', 'c'],
      aspectDirs: [],
      instanceDirs: ['y', 'x'],
      templateDirs: []
    };
    
    const config2 = {
      classDirs: ['a', 'b', 'c'],
      aspectDirs: [],
      instanceDirs: ['x', 'y'],
      templateDirs: []
    };
    
    const hash1 = generateBuildHash(config1);
    const hash2 = generateBuildHash(config2);
    
    assert.strictEqual(hash1, hash2, 'Order should not affect hash');
  });
});
