/**
 * Config Generation Tests
 *
 * Test --save-config flag functionality for generating config files
 * from CLI builds (Session 31 feature)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '..', 'cli.js');

/**
 * Run CLI command and return output
 */
async function runCLI(args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Create a minimal test stack
 */
async function createTestStack(tempDir) {
  // Create directories
  await fs.mkdir(join(tempDir, 'classes'), { recursive: true });
  await fs.mkdir(join(tempDir, 'instances'), { recursive: true });
  await fs.mkdir(join(tempDir, 'templates'), { recursive: true });

  // Create minimal class schema
  const classSchema = {
    class: 'simple_class',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        class: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id', 'class']
    }
  };
  await fs.writeFile(
    join(tempDir, 'classes', 'simple_class.schema.json'),
    JSON.stringify(classSchema, null, 2)
  );

  // Create minimal instance
  const instance = {
    id: 'test',
    class: 'simple_class',
    name: 'Test Instance'
  };
  await fs.writeFile(
    join(tempDir, 'instances', 'test.json'),
    JSON.stringify(instance, null, 2)
  );

  // Create minimal template
  await fs.writeFile(
    join(tempDir, 'templates', 'output.txt'),
    'Name: {{name}}'
  );

  // Create global instance with render field
  const global = {
    id: 'global',
    class: 'simple_class',
    render: ['output.txt']
  };
  await fs.writeFile(
    join(tempDir, 'instances', 'global.json'),
    JSON.stringify(global, null, 2)
  );

  return tempDir;
}

describe('Config Generation (--save-config)', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'struktur-save-config-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Functionality', () => {
    it('should save config after successful build', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'generated.build.json');
      
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      assert.equal(result.exitCode, 0, 'Build should succeed');
      assert.match(result.stdout, /Saved config to/, 'Should confirm config save');

      // Check that config file was created
      const configExists = await fs.access(configPath)
        .then(() => true)
        .catch(() => false);
      assert.ok(configExists, 'Config file should exist');

      // Parse and validate config content
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      assert.ok(config.classes, 'Config should have classes');
      assert.ok(config.instances, 'Config should have instances');
      assert.ok(config.templates, 'Config should have templates');
      assert.ok(Array.isArray(config.classes), 'classes should be array');
      assert.ok(Array.isArray(config.instances), 'instances should be array');
      assert.ok(Array.isArray(config.templates), 'templates should be array');
    });

    it('should use snake_case field names in saved config', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'snake_case.build.json');
      
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--build-dir', join(tempDir, 'custom-build'),
        '--save-config', configPath
      ], tempDir);

      assert.equal(result.exitCode, 0, 'Build should succeed');

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Should use build_dir (snake_case), not buildDir
      assert.ok(config.build_dir, 'Should use build_dir field');
      assert.strictEqual(config.buildDir, undefined, 'Should not use camelCase buildDir');
    });

    it('should save minimal config (only provided paths)', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'minimal.build.json');
      
      // Build without aspects (optional)
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      assert.equal(result.exitCode, 0, 'Build should succeed');

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Should not include aspects if not provided
      assert.strictEqual(config.aspects, undefined, 'Should not include empty aspects');
    });

    it('should save all flags when provided', async () => {
      await createTestStack(tempDir);

      // Create aspects directory
      await fs.mkdir(join(tempDir, 'aspects'), { recursive: true });

      const configPath = join(tempDir, 'full.build.json');
      
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--aspects', join(tempDir, 'aspects'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--build-dir', join(tempDir, 'output'),
        '--engine', 'nunjucks', // Use nunjucks instead of handlebars (default)
        '--save-config', configPath
      ], tempDir);

      assert.equal(result.exitCode, 0, 'Build should succeed');

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      assert.ok(config.classes, 'Should have classes');
      assert.ok(config.aspects, 'Should have aspects');
      assert.ok(config.instances, 'Should have instances');
      assert.ok(config.templates, 'Should have templates');
      assert.ok(config.build_dir, 'Should have build_dir');
      assert.equal(config.template_engine, 'nunjucks', 'Should have template_engine');
    });
  });

  describe('Relative Path Handling', () => {
    it('should save paths relative to config file location', async () => {
      await createTestStack(tempDir);

      // Save config in subdirectory
      await fs.mkdir(join(tempDir, 'configs'), { recursive: true });
      const configPath = join(tempDir, 'configs', 'project.build.json');
      
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      assert.equal(result.exitCode, 0, 'Build should succeed');

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Paths should be relative to config file location
      assert.ok(config.classes[0].includes('..'), 'classes path should be relative');
      assert.ok(config.instances[0].includes('..'), 'instances path should be relative');
      assert.ok(config.templates[0].includes('..'), 'templates path should be relative');
    });

    it('should handle config in same directory as stack', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'stack.build.json');
      
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      assert.equal(result.exitCode, 0, 'Build should succeed');

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Paths should be simple subdirectories (no ../)
      assert.ok(!config.classes[0].includes('..'), 'Should not use .. for same-level directories');
      assert.match(config.classes[0], /classes/, 'Should reference classes directory');
    });
  });

  describe('Reusability', () => {
    it('should generate reusable config that builds successfully', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'reusable.build.json');
      
      // First build with CLI flags, save config
      const saveResult = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--build-dir', join(tempDir, 'build1'),
        '--save-config', configPath
      ], tempDir);

      assert.equal(saveResult.exitCode, 0, 'Initial build should succeed');

      // Second build using saved config
      const reuseResult = await runCLI([
        'build',
        '--config', configPath,
        '--build-dir', join(tempDir, 'build2')  // Override to avoid collision
      ], tempDir);

      assert.equal(reuseResult.exitCode, 0, 'Build with saved config should succeed');
      assert.match(reuseResult.stdout, /Build complete/, 'Should complete successfully');

      // Verify both builds created output
      const build1Exists = await fs.access(join(tempDir, 'build1'))
        .then(() => true)
        .catch(() => false);
      const build2Exists = await fs.access(join(tempDir, 'build2'))
        .then(() => true)
        .catch(() => false);
      
      assert.ok(build1Exists, 'First build output should exist');
      assert.ok(build2Exists, 'Second build output should exist');
    });

    it('should allow CLI flags to override saved config', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'override-test.build.json');
      
      // Save config
      await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      // Create alternate classes directory
      await fs.mkdir(join(tempDir, 'classes2'), { recursive: true });
      await fs.copyFile(
        join(tempDir, 'classes', 'simple_class.schema.json'),
        join(tempDir, 'classes2', 'simple_class.schema.json')
      );

      // Build with config but override classes
      const result = await runCLI([
        'build',
        '--config', configPath,
        '--classes', join(tempDir, 'classes2')  // Override
      ], tempDir);

      assert.equal(result.exitCode, 0, 'Override build should succeed');
    });
  });

  describe('Error Handling', () => {
    it('should not save config if build fails', async () => {
      await createTestStack(tempDir);

      // Create instance with invalid schema (missing required field)
      const invalidInstance = {
        id: 'invalid',
        // Missing required 'class' field
        name: 'Invalid'
      };
      await fs.writeFile(
        join(tempDir, 'instances', 'invalid.json'),
        JSON.stringify(invalidInstance, null, 2)
      );

      const configPath = join(tempDir, 'should-not-exist.build.json');
      
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      // Build might fail due to validation
      // Config should only be saved on successful build
      const configExists = await fs.access(configPath)
        .then(() => true)
        .catch(() => false);
      
      if (result.exitCode !== 0) {
        assert.ok(!configExists, 'Config should not be saved on failed build');
      }
    });

    it('should handle invalid save path', async () => {
      await createTestStack(tempDir);

      const invalidPath = '/nonexistent/directory/config.build.json';
      
      const result = await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', invalidPath
      ], tempDir);

      // Should fail with clear error
      assert.notEqual(result.exitCode, 0, 'Should fail with invalid path');
    });
  });

  describe('JSON Format', () => {
    it('should save pretty-printed JSON', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'pretty.build.json');
      
      await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      const configContent = await fs.readFile(configPath, 'utf-8');
      
      // Should be formatted with indentation
      assert.match(configContent, /\n  /, 'Should have indentation');
      assert.match(configContent, /{\n/, 'Should have newlines');
      
      // Should be valid JSON
      assert.doesNotThrow(() => JSON.parse(configContent), 'Should be valid JSON');
    });

    it('should preserve array format', async () => {
      await createTestStack(tempDir);

      const configPath = join(tempDir, 'arrays.build.json');
      
      await runCLI([
        'build',
        '--classes', join(tempDir, 'classes'),
        '--instances', join(tempDir, 'instances'),
        '--templates', join(tempDir, 'templates'),
        '--save-config', configPath
      ], tempDir);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // All directory fields should be arrays
      assert.ok(Array.isArray(config.classes), 'classes should be array');
      assert.ok(Array.isArray(config.instances), 'instances should be array');
      assert.ok(Array.isArray(config.templates), 'templates should be array');
    });
  });
});
