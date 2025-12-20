/**
 * Handlebars Adapter Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { HandlebarsAdapter } from '../src/adapters/handlebars_adapter.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'templates');

describe('HandlebarsAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new HandlebarsAdapter();
  });

  describe('basic functionality', () => {
    it('should create adapter instance', () => {
      assert.ok(adapter instanceof HandlebarsAdapter);
      assert.strictEqual(adapter.getEngineName(), 'handlebars');
    });

    it('should accept config', () => {
      const config = { strict: true, searchPaths: ['/tmp'] };
      const adapter = new HandlebarsAdapter(config);
      assert.deepStrictEqual(adapter.config, config);
      assert.deepStrictEqual(adapter.searchPaths, ['/tmp']);
    });
  });

  describe('template rendering', () => {
    it('should render simple template', async () => {
      const templatePath = path.join(FIXTURES_DIR, 'simple.hbs');
      await fs.mkdir(FIXTURES_DIR, { recursive: true });
      await fs.writeFile(templatePath, 'Hello {{name}}!');

      const result = await adapter.render(templatePath, { name: 'World' });
      assert.strictEqual(result, 'Hello World!');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });

    it('should render template with iteration', async () => {
      const templatePath = path.join(FIXTURES_DIR, 'list.hbs');
      await fs.mkdir(FIXTURES_DIR, { recursive: true });
      await fs.writeFile(templatePath, '{{#each items}}{{this}},{{/each}}');

      const result = await adapter.render(templatePath, { items: ['a', 'b', 'c'] });
      assert.strictEqual(result, 'a,b,c,');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });

    it('should render template with conditionals', async () => {
      const templatePath = path.join(FIXTURES_DIR, 'conditional.hbs');
      await fs.mkdir(FIXTURES_DIR, { recursive: true });
      await fs.writeFile(templatePath, '{{#if show}}visible{{else}}hidden{{/if}}');

      const result1 = await adapter.render(templatePath, { show: true });
      assert.strictEqual(result1, 'visible');

      const result2 = await adapter.render(templatePath, { show: false });
      assert.strictEqual(result2, 'hidden');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });
  });

  describe('helpers', () => {
    it('should register and use custom helper', async () => {
      adapter.registerHelper('uppercase', (str) => str.toUpperCase());

      const templatePath = path.join(FIXTURES_DIR, 'helper.hbs');
      await fs.mkdir(FIXTURES_DIR, { recursive: true });
      await fs.writeFile(templatePath, '{{uppercase name}}');

      const result = await adapter.render(templatePath, { name: 'hello' });
      assert.strictEqual(result, 'HELLO');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });

    it('should register multiple helpers', async () => {
      adapter.registerHelper('add', (a, b) => a + b);
      adapter.registerHelper('multiply', (a, b) => a * b);

      const templatePath = path.join(FIXTURES_DIR, 'math.hbs');
      await fs.mkdir(FIXTURES_DIR, { recursive: true });
      await fs.writeFile(templatePath, '{{add a b}},{{multiply a b}}');

      const result = await adapter.render(templatePath, { a: 3, b: 4 });
      assert.strictEqual(result, '7,12');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });
  });

  describe('partials', () => {
    it('should register and use partial', async () => {
      adapter.registerPartial('header', '<h1>{{title}}</h1>');

      const templatePath = path.join(FIXTURES_DIR, 'with-partial.hbs');
      await fs.mkdir(FIXTURES_DIR, { recursive: true });
      await fs.writeFile(templatePath, '{{> header}}<p>{{content}}</p>');

      const result = await adapter.render(templatePath, {
        title: 'Welcome',
        content: 'Hello'
      });
      assert.strictEqual(result, '<h1>Welcome</h1><p>Hello</p>');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });

    it('should load partials from directory', async () => {
      const partialsDir = path.join(FIXTURES_DIR, 'partials');
      await fs.mkdir(partialsDir, { recursive: true });
      await fs.writeFile(path.join(partialsDir, 'footer.hbs'), '<footer>{{text}}</footer>');

      await adapter.loadPartials(partialsDir);

      const templatePath = path.join(FIXTURES_DIR, 'with-footer.hbs');
      await fs.writeFile(templatePath, '{{> footer.hbs}}');

      const result = await adapter.render(templatePath, { text: 'Copyright 2025' });
      assert.strictEqual(result, '<footer>Copyright 2025</footer>');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });
  });

  describe('search paths', () => {
    it('should set search paths', () => {
      adapter.setSearchPaths(['/path/one', '/path/two']);
      assert.deepStrictEqual(adapter.searchPaths, ['/path/one', '/path/two']);
    });

    it('should convert single path to array', () => {
      adapter.setSearchPaths('/single/path');
      assert.deepStrictEqual(adapter.searchPaths, ['/single/path']);
    });

    it('should find template in search paths', async () => {
      const templatesDir = path.join(FIXTURES_DIR, 'search');
      await fs.mkdir(templatesDir, { recursive: true });
      await fs.writeFile(path.join(templatesDir, 'test.hbs'), 'Found: {{value}}');

      adapter.setSearchPaths([templatesDir]);
      const result = await adapter.render('test.hbs', { value: 42 });
      assert.strictEqual(result, 'Found: 42');

      await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    });
  });
});
