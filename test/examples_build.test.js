/**
 * Tests for building example stacks
 * Ensures example stacks build successfully with their struktur.build.json configs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStack } from '../src/build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = join(__dirname, '..', 'examples');

// Find all struktur.build.json files in examples/
const exampleStacks = [
  { name: 'docked', path: join(examplesDir, 'docked') },
  { name: 'skribe', path: join(examplesDir, 'skribe') }
].filter(stack => existsSync(join(stack.path, 'struktur.build.json')));

describe('Example Stack Builds', () => {
  for (const stack of exampleStacks) {
    it(`should build ${stack.name} stack successfully`, async () => {
      const configPath = join(stack.path, 'struktur.build.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      
      // Resolve paths relative to config file location
      const resolvePath = (p) => join(stack.path, p);
      
      const buildOptions = {
        classDirs: (config.classes || config.classDirs || []).map(resolvePath),
        instanceDirs: (config.instances || config.instanceDirs || []).map(resolvePath),
        aspectDirs: (config.aspects || config.aspectDirs || []).map(resolvePath),
        templateDirs: (config.templates || config.templateDirs || []).map(resolvePath),
        buildDir: resolvePath(config.build_dir || config.buildDir || 'build'),
        engine: config.template_engine || config.engine || 'handlebars',
        renderTasks: config.render || [],
        logger: {
          log: () => {}, // Silent during tests
          warn: () => {},
          error: () => {}
        }
      };
      
      // Clean previous build
      await rm(buildOptions.buildDir, { recursive: true, force: true });
      
      // Attempt to build
      await assert.doesNotReject(
        async () => await buildStack(buildOptions),
        `${stack.name} stack should build without errors`
      );
      
      // Clean up after test
      await rm(buildOptions.buildDir, { recursive: true, force: true });
    });
  }
  
  it('should find at least one example stack to test', () => {
    assert.ok(exampleStacks.length > 0, 'No example stacks with struktur.build.json found');
  });
});
