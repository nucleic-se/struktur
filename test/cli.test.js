/**
 * CLI Tests
 *
 * Test the command-line interface for validation and info commands
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '..', 'cli.js');
const FIXTURES_DIR = join(__dirname, 'fixtures');

/**
 * Run CLI command and return output
 */
async function runCLI(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
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

describe('CLI: validate command', () => {
  it('should validate Skribe stack successfully', async () => {
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes'),
      '-i', join(FIXTURES_DIR, 'skribe')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /✓ about \(page\)/, 'Should show valid instance');
    assert.match(result.stdout, /Total:\s+21/, 'Should show total count');
    assert.match(result.stdout, /Valid:\s+21/, 'Should show all valid');
    assert.match(result.stdout, /Invalid:\s+0/, 'Should show no invalid');
  });

  it('should output JSON format when --json flag is used', async () => {
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes'),
      '-i', join(FIXTURES_DIR, 'skribe'),
      '--json'
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');

    const json = JSON.parse(result.stdout);
    assert.ok(json.results, 'Should have results array');
    assert.ok(json.summary, 'Should have summary object');
    assert.equal(json.summary.total, 21, 'Summary should show 21 total');
    assert.equal(json.summary.valid, 21, 'Summary should show 21 valid');
    assert.equal(json.summary.invalid, 0, 'Summary should show 0 invalid');
    assert.equal(json.summary.errorCount, 0, 'Summary should show 0 errors');

    // Check first result structure
    assert.ok(json.results[0].instance, 'Result should have instance');
    assert.ok(json.results[0].class, 'Result should have class');
    assert.equal(typeof json.results[0].valid, 'boolean', 'Result should have valid flag');
    assert.ok(Array.isArray(json.results[0].errors), 'Result should have errors array');
  });

  it('should use quiet mode with --quiet flag', async () => {
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes'),
      '-i', join(FIXTURES_DIR, 'skribe'),
      '--quiet'
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /=== Summary ===/, 'Should show summary');
    assert.doesNotMatch(result.stdout, /=== Validation Results ===/, 'Should not show results header');
  });

  it('should validate with aspects when -a flag is provided', async () => {
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'universal', 'classes'),
      '-a', join(FIXTURES_DIR, 'universal', 'aspects'),
      '-i', join(FIXTURES_DIR, 'universal')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /Valid:/, 'Should show validation results');
  });

  it('should exit with code 1 when validation fails', async () => {
    // Create a temporary invalid instance
    const tempDir = join(FIXTURES_DIR, 'temp_invalid');
    const classesDir = join(tempDir, 'classes');
    const instancesDir = join(tempDir, 'instances');

    await fs.mkdir(classesDir, { recursive: true });
    await fs.mkdir(instancesDir, { recursive: true });

    // Create a simple class
    await fs.writeFile(
      join(classesDir, 'test_class.class.json'),
      JSON.stringify({
        $class: 'test_class',
        $schema: {
          type: 'object',
          required: ['$id', 'required_field'],
          properties: {
            $id: { type: 'string' },
            required_field: { type: 'string' }
          }
        }
      })
    );

    // Create an invalid instance (missing required_field)
    await fs.writeFile(
      join(instancesDir, 'invalid.json'),
      JSON.stringify({
        $id: 'invalid_instance',
        $class: 'test_class'
      })
    );

    const result = await runCLI([
      'validate',
      '-c', classesDir,
      '-i', instancesDir
    ]);

    assert.equal(result.exitCode, 1, 'Should exit with code 1 for validation failures');
    assert.match(result.stdout, /✗ invalid_instance/, 'Should show failed instance');
    assert.match(result.stdout, /Invalid:\s+1/, 'Should show 1 invalid');

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle missing classes directory', async () => {
    const result = await runCLI([
      'validate',
      '-c', '/nonexistent/path',
      '-i', join(FIXTURES_DIR, 'skribe')
    ]);

    assert.equal(result.exitCode, 1, 'Should exit with code 1');
    assert.match(result.stderr, /Error:/, 'Should show error message');
  });

  it('should default instances directory to classes directory', async () => {
    // Skribe has instances in the same directory as classes
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'skribe')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /Total:\s+\d+/, 'Should find and validate instances');
  });

  it('should support multiple classes directories', async () => {
    // Load classes from both Skribe and Universal
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes'), join(FIXTURES_DIR, 'universal', 'classes'),
      '-i', join(FIXTURES_DIR, 'skribe')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /Total:\s+21/, 'Should validate Skribe instances');
    assert.match(result.stdout, /Valid:\s+21/, 'Should show all valid');
  });

  it('should support multiple aspects directories', async () => {
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'universal', 'classes'),
      '-a', join(FIXTURES_DIR, 'universal', 'aspects'), join(FIXTURES_DIR, 'docked', 'aspects'),
      '-i', join(FIXTURES_DIR, 'universal')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /Valid:/, 'Should show validation results');
  });

  it('should support multiple instances directories', async () => {
    const result = await runCLI([
      'validate',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes'),
      '-i', join(FIXTURES_DIR, 'skribe', 'instances', 'pages'), join(FIXTURES_DIR, 'skribe', 'instances', 'posts')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    // Should find instances from both directories
    assert.match(result.stdout, /Total:\s+\d+/, 'Should count instances from all directories');
  });
});

describe('CLI: info command', () => {
  it('should display classes from Skribe stack', async () => {
    const result = await runCLI([
      'info',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /=== Classes ===/, 'Should show classes header');
    assert.match(result.stdout, /blog_post/, 'Should list blog_post class');
    assert.match(result.stdout, /content_base/, 'Should list content_base class');
    assert.match(result.stdout, /page/, 'Should list page class');
    assert.match(result.stdout, /Total: 4 classes/, 'Should show count');
  });

  it('should display classes and aspects from Universal stack', async () => {
    const result = await runCLI([
      'info',
      '-c', join(FIXTURES_DIR, 'universal', 'classes'),
      '-a', join(FIXTURES_DIR, 'universal', 'aspects')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /=== Classes ===/, 'Should show classes header');
    assert.match(result.stdout, /=== Aspects ===/, 'Should show aspects header');
    assert.match(result.stdout, /entity_base/, 'Should list entity_base class');
    // Universal fixtures may or may not have aspects loaded - just check structure
    assert.match(result.stdout, /Total: \d+ aspects/, 'Should show aspect count');
  });

  it('should show inheritance relationships', async () => {
    const result = await runCLI([
      'info',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /blog_post \(inherits: content_base\)/, 'Should show parent');
    assert.match(result.stdout, /content_base \(inherits: none\)/, 'Should show no parent');
  });

  it('should handle classes directory with no files', async () => {
    const tempDir = join(FIXTURES_DIR, 'temp_empty');
    await fs.mkdir(tempDir, { recursive: true });

    const result = await runCLI([
      'info',
      '-c', tempDir
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /Total: 0 classes/, 'Should show 0 classes');

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle missing classes directory', async () => {
    const result = await runCLI([
      'info',
      '-c', '/nonexistent/path'
    ]);

    // Info command treats non-existent dir as empty (no error)
    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /Total: 0 classes/, 'Should show 0 classes');
  });

  it('should support multiple classes directories', async () => {
    const result = await runCLI([
      'info',
      '-c', join(FIXTURES_DIR, 'skribe', 'classes'), join(FIXTURES_DIR, 'universal', 'classes')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    // Should show classes from both Skribe (3) and Universal (3)
    assert.match(result.stdout, /blog_post/, 'Should show Skribe classes');
    assert.match(result.stdout, /entity_base/, 'Should show Universal classes');
    assert.match(result.stdout, /Total: 7 classes/, 'Should count all classes from both directories');
  });

  it('should support multiple aspects directories', async () => {
    const result = await runCLI([
      'info',
      '-c', join(FIXTURES_DIR, 'universal', 'classes'),
      '-a', join(FIXTURES_DIR, 'universal', 'aspects'), join(FIXTURES_DIR, 'docked', 'aspects')
    ]);

    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /=== Aspects ===/, 'Should show aspects header');
    // Should show total from both directories
    assert.match(result.stdout, /Total: \d+ aspects/, 'Should count aspects from all directories');
  });
});

describe('CLI: argument validation', () => {
  it('should show help when no command is provided', async () => {
    const result = await runCLI(['--help']);

    // Commander shows help and exits with 0
    assert.equal(result.exitCode, 0, 'Should exit with code 0');
    assert.match(result.stdout, /Usage:|Commands:/, 'Should show help text');
  });

  it('should show error when required option is missing', async () => {
    const result = await runCLI(['validate']);

    assert.equal(result.exitCode, 1, 'Should exit with code 1');
    assert.match(result.stderr, /(provide a stack directory|--classes)/i, 'Should mention missing stack directory or classes option');
  });

  it('should show error for unknown command', async () => {
    const result = await runCLI(['unknown-command']);

    assert.equal(result.exitCode, 1, 'Should exit with code 1');
    assert.match(result.stderr, /unknown command/i, 'Should show unknown command error');
  });
});
