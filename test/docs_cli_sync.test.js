/**
 * Documentation Sync Tests
 * 
 * Validates that CLI documentation matches actual CLI implementation.
 * Prevents docs from drifting out of sync with code.
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
const CLI_REFERENCE_PATH = join(__dirname, '..', 'docs', 'cli-reference.md');

/**
 * Get CLI help output
 */
async function getCliHelp(command = null) {
  return new Promise((resolve, reject) => {
    const args = command ? [CLI_PATH, command, '--help'] : [CLI_PATH, '--help'];
    const child = spawn('node', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    child.on('error', (err) => reject(err));
  });
}

/**
 * Extract flags from CLI help output
 */
function extractFlags(helpText) {
  const flags = new Set();
  const lines = helpText.split('\n');
  
  for (const line of lines) {
    // Match patterns like: -c, --classes <dirs...>
    const matchWithShort = line.match(/^\s*(-[a-z]),\s+(--[a-z-]+)/i);
    if (matchWithShort) {
      flags.add(matchWithShort[1]); // Short flag
      flags.add(matchWithShort[2]); // Long flag
      continue;
    }
    // Match long-only flags: --some-flag (no comma before it)
    const matchLongOnly = line.match(/^\s+(--[a-z-]+)\s+/i);
    if (matchLongOnly) {
      flags.add(matchLongOnly[1]);
    }
  }
  
  return flags;
}

/**
 * Extract flags from cli-reference.md
 */
async function extractDocumentedFlags(command) {
  const content = await fs.readFile(CLI_REFERENCE_PATH, 'utf-8');
  const flags = new Set();
  
  // Find the command section
  const commandHeader = `### \`${command}\``;
  const commandIndex = content.indexOf(commandHeader);
  if (commandIndex === -1) {
    throw new Error(`Command ${command} not found in CLI reference`);
  }
  
  // Find next command section or end of file
  const nextCommandIndex = content.indexOf('\n### `', commandIndex + 1);
  const commandSection = nextCommandIndex > -1 
    ? content.slice(commandIndex, nextCommandIndex)
    : content.slice(commandIndex);
  
  // Extract flags from markdown
  const lines = commandSection.split('\n');
  for (const line of lines) {
    // Match: - `-c, --classes <dirs...>` or - `--exact`
    const match = line.match(/- `(-[a-z]),?\s+(--[a-z-]+)/i);
    if (match) {
      flags.add(match[1]);
      flags.add(match[2]);
    }
    const longMatch = line.match(/- `(--[a-z-]+)/i);
    if (longMatch && !line.includes(',')) {
      flags.add(longMatch[1]);
    }
  }
  
  return flags;
}

describe('CLI Documentation Sync', () => {
  
  describe('build command', () => {
    it('should document all flags from --help', async () => {
      const { stdout } = await getCliHelp('build');
      const actualFlags = extractFlags(stdout);
      const documentedFlags = await extractDocumentedFlags('build');
      
      // Check all actual flags are documented
      for (const flag of actualFlags) {
        assert.ok(
          documentedFlags.has(flag),
          `Flag ${flag} exists in CLI but not documented in cli-reference.md`
        );
      }
    });
    
    it('should not document non-existent flags', async () => {
      const { stdout } = await getCliHelp('build');
      const actualFlags = extractFlags(stdout);
      const documentedFlags = await extractDocumentedFlags('build');
      
      // Check documented flags exist in CLI (no phantom docs)
      for (const flag of documentedFlags) {
        // Skip -h/--help as it's universal
        if (flag === '-h' || flag === '--help') continue;
        
        assert.ok(
          actualFlags.has(flag),
          `Flag ${flag} documented in cli-reference.md but doesn't exist in CLI`
        );
      }
    });
  });
  
  describe('validate command', () => {
    it('should document all flags from --help', async () => {
      const { stdout } = await getCliHelp('validate');
      const actualFlags = extractFlags(stdout);
      const documentedFlags = await extractDocumentedFlags('validate');
      
      for (const flag of actualFlags) {
        assert.ok(
          documentedFlags.has(flag),
          `Flag ${flag} exists in CLI but not documented in cli-reference.md`
        );
      }
    });
  });
  
  describe('generate command', () => {
    it('should document all flags from --help', async () => {
      const { stdout } = await getCliHelp('generate');
      const actualFlags = extractFlags(stdout);
      const documentedFlags = await extractDocumentedFlags('generate');
      
      for (const flag of actualFlags) {
        assert.ok(
          documentedFlags.has(flag),
          `Flag ${flag} exists in CLI but not documented in cli-reference.md`
        );
      }
    });
  });
  
  describe('config file documentation', () => {
    it('should document snake_case field names', async () => {
      const content = await fs.readFile(CLI_REFERENCE_PATH, 'utf-8');
      
      // Check for snake_case in config examples
      assert.ok(
        content.includes('build_dir'),
        'Config should use snake_case: build_dir'
      );
      assert.ok(
        content.includes('template_engine'),
        'Config should use snake_case: template_engine'
      );
      
      // Should NOT have camelCase versions
      const configSection = content.match(/### Build Config File[\s\S]*?---/)?.[0] || '';
      assert.ok(
        !configSection.includes('"buildDir"'),
        'Config should not use camelCase: buildDir (use build_dir)'
      );
      assert.ok(
        !configSection.includes('"engine"') || configSection.includes('template_engine'),
        'Config should not use "engine" alone (use template_engine)'
      );
    });
    
    it('should document flexible config naming', async () => {
      const content = await fs.readFile(CLI_REFERENCE_PATH, 'utf-8');
      
      assert.ok(
        content.includes('*.build.json'),
        'Should document flexible *.build.json naming'
      );
      assert.ok(
        content.includes('Auto-discovers') || content.includes('auto-discover'),
        'Should mention auto-discovery behavior'
      );
    });
    
    it('should document --save-config flag', async () => {
      const content = await fs.readFile(CLI_REFERENCE_PATH, 'utf-8');
      
      assert.ok(
        content.includes('--save-config'),
        'Should document --save-config flag'
      );
      assert.ok(
        content.includes('Save successful build settings') || content.includes('save'),
        'Should explain what --save-config does'
      );
    });
  });
});
