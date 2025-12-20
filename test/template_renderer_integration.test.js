/**
 * Integration tests for TemplateRenderer with real template adapters
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TemplateRenderer } from '../src/template_renderer.js';
import NunjucksAdapter from '../src/adapters/nunjucks_adapter.js';
import { TemplateNotFoundError } from '../src/template_errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'template_renderer');
const tempDir = path.join(__dirname, 'temp', 'template_renderer');

describe('TemplateRenderer Integration', () => {
  before(async () => {
    // Create fixtures directory
    await fs.mkdir(fixturesDir, { recursive: true });
    
    // Create temp output directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create test templates
    await fs.writeFile(
      path.join(fixturesDir, 'simple.njk'),
      'Hello {{ name }}!'
    );
    
    await fs.writeFile(
      path.join(fixturesDir, 'list.njk'),
      '{% for item in items %}{{ item.title }}\n{% endfor %}'
    );
    
    await fs.writeFile(
      path.join(fixturesDir, 'macro_test.njk'),
      `{% macro card(title) %}<div>{{ title }}</div>{% endmacro %}
{{ card('Test Card') }}`
    );
    
    await fs.writeFile(
      path.join(fixturesDir, 'filter_test.njk'),
      `{% set nums = [3, 1, 2] %}
{{ nums | sort | join(',') }}`
    );
    
    await fs.writeFile(
      path.join(fixturesDir, '_partial.njk'),
      'Partial content: {{ data }}'
    );
    
    await fs.writeFile(
      path.join(fixturesDir, 'with_include.njk'),
      `Main template
{% include "_partial.njk" %}`
    );
  });
  
  after(async () => {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.rm(fixturesDir, { recursive: true, force: true });
  });

  describe('Basic Rendering', () => {
    it('should render simple template with context', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = { name: 'World' };
      const tasks = [
        { template: 'simple.njk', output: '/simple.txt' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 1);
      
      const content = await fs.readFile(path.join(tempDir, 'simple.txt'), 'utf-8');
      assert.equal(content, 'Hello World!');
    });
    
    it('should render template with array iteration', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = {
        items: [
          { title: 'First' },
          { title: 'Second' },
          { title: 'Third' }
        ]
      };
      const tasks = [
        { template: 'list.njk', output: '/list.txt' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 1);
      
      const content = await fs.readFile(path.join(tempDir, 'list.txt'), 'utf-8');
      assert.equal(content, 'First\nSecond\nThird\n');
    });
    
    it('should render template with macros', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = {};
      const tasks = [
        { template: 'macro_test.njk', output: '/macro.html' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 1);
      
      const content = await fs.readFile(path.join(tempDir, 'macro.html'), 'utf-8');
      assert.match(content, /<div>Test Card<\/div>/);
    });
    
    it('should render template with built-in filters', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = {};
      const tasks = [
        { template: 'filter_test.njk', output: '/filter.txt' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 1);
      
      const content = await fs.readFile(path.join(tempDir, 'filter.txt'), 'utf-8');
      assert.match(content, /1,2,3/);
    });
    
    it('should render template with includes', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = { data: 'test data' };
      const tasks = [
        { template: 'with_include.njk', output: '/include.txt' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 1);
      
      const content = await fs.readFile(path.join(tempDir, 'include.txt'), 'utf-8');
      assert.match(content, /Main template/);
      assert.match(content, /Partial content: test data/);
    });
  });

  describe('Task Format Normalization', () => {
    it('should accept format [{template, output}]', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = { name: 'Test' };
      const tasks = [
        { template: 'simple.njk', output: '/format_test.txt' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 1);
      
      const content = await fs.readFile(path.join(tempDir, 'format_test.txt'), 'utf-8');
      assert.equal(content, 'Hello Test!');
    });
    
    it('should reject tasks without template field', async () => {
      const adapter = new NunjucksAdapter();
      const renderer = new TemplateRenderer(adapter);
      
      const tasks = [{ output: '/test.txt' }];
      
      await assert.rejects(
        () => renderer.renderAll(tasks, {}, tempDir),
        /Render tasks must use format/
      );
    });
    
    it('should reject tasks without output field', async () => {
      const adapter = new NunjucksAdapter();
      const renderer = new TemplateRenderer(adapter);
      
      const tasks = [{ template: 'simple.njk' }];
      
      await assert.rejects(
        () => renderer.renderAll(tasks, {}, tempDir),
        /Render tasks must use format/
      );
    });
  });

  describe('Multiple Templates', () => {
    it('should render multiple templates in sequence', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = {
        name: 'Multi',
        items: [{ title: 'Item 1' }]
      };
      const tasks = [
        { template: 'simple.njk', output: '/multi1.txt' },
        { template: 'list.njk', output: '/multi2.txt' },
        { template: 'macro_test.njk', output: '/multi3.html' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 3);
      
      // Verify all files exist
      await fs.access(path.join(tempDir, 'multi1.txt'));
      await fs.access(path.join(tempDir, 'multi2.txt'));
      await fs.access(path.join(tempDir, 'multi3.html'));
    });
  });

  describe('Error Handling', () => {
    it('should throw TemplateNotFoundError for missing template', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = {};
      const tasks = [
        { template: 'missing.njk', output: '/missing.txt' }
      ];
      
      await assert.rejects(
        async () => await renderer.renderAll(tasks, canonical, tempDir),
        (err) => {
          assert(err.message.includes('validation issue'));
          return true;
        }
      );
    });
    
    it('should provide smart suggestions for missing templates', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = {};
      const tasks = [
        { template: 'simple', output: '/no_ext.txt' }  // Missing .njk
      ];
      
      await assert.rejects(
        async () => await renderer.renderAll(tasks, canonical, tempDir),
        (err) => {
          assert(err.message.includes('validation issue'));
          return true;
        }
      );
    });
  });

  describe('Output Path Security', () => {
    it('should create nested output directories', async () => {
      const adapter = new NunjucksAdapter();
      adapter.setSearchPaths([fixturesDir]);
      
      const renderer = new TemplateRenderer(adapter);
      renderer.setSearchPaths([fixturesDir]);
      
      const canonical = { name: 'Nested' };
      const tasks = [
        { template: 'simple.njk', output: '/deep/nested/path/output.txt' }
      ];
      
      const result = await renderer.renderAll(tasks, canonical, tempDir);
      
      assert.equal(result.renderedCount, 1);
      
      const content = await fs.readFile(
        path.join(tempDir, 'deep', 'nested', 'path', 'output.txt'),
        'utf-8'
      );
      assert.equal(content, 'Hello Nested!');
    });
  });
});
