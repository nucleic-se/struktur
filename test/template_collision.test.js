/**
 * Template Collision Detection Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectTemplateCollisions, formatCollisionReport } from '../src/utils/template_collision.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'template_collisions');

describe('Template Collision Detection', () => {
  beforeEach(async () => {
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
  });

  describe('detectTemplateCollisions', () => {
    it('should detect no collisions with single directory', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      await fs.mkdir(dir1, { recursive: true });
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'content');
      await fs.writeFile(path.join(dir1, 'post.hbs'), 'content');

      const report = await detectTemplateCollisions([dir1]);

      assert.strictEqual(report.collisionCount, 0);
      assert.strictEqual(report.totalTemplates, 2);
      assert.strictEqual(report.uniqueTemplates, 2);
    });

    it('should detect collision when same template in multiple directories', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      const dir2 = path.join(FIXTURES_DIR, 'stack2');
      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });
      
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'version 1');
      await fs.writeFile(path.join(dir2, 'page.hbs'), 'version 2');

      const report = await detectTemplateCollisions([dir1, dir2]);

      assert.strictEqual(report.collisionCount, 1);
      assert.strictEqual(report.totalTemplates, 1);
      assert.strictEqual(report.uniqueTemplates, 0);
      assert.strictEqual(report.collisions[0].templateKey, 'page.hbs');
      assert.strictEqual(report.collisions[0].sources.length, 2);
      assert.strictEqual(report.collisions[0].winner, dir2); // Last wins
    });

    it('should detect multiple collisions', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      const dir2 = path.join(FIXTURES_DIR, 'stack2');
      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });
      
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'v1');
      await fs.writeFile(path.join(dir1, 'post.hbs'), 'v1');
      await fs.writeFile(path.join(dir2, 'page.hbs'), 'v2');
      await fs.writeFile(path.join(dir2, 'post.hbs'), 'v2');

      const report = await detectTemplateCollisions([dir1, dir2]);

      assert.strictEqual(report.collisionCount, 2);
      assert.strictEqual(report.totalTemplates, 2);
    });

    it('should handle nested directory templates', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      const dir2 = path.join(FIXTURES_DIR, 'stack2');
      await fs.mkdir(path.join(dir1, 'layouts'), { recursive: true });
      await fs.mkdir(path.join(dir2, 'layouts'), { recursive: true });
      
      await fs.writeFile(path.join(dir1, 'layouts', 'base.hbs'), 'v1');
      await fs.writeFile(path.join(dir2, 'layouts', 'base.hbs'), 'v2');

      const report = await detectTemplateCollisions([dir1, dir2]);

      assert.strictEqual(report.collisionCount, 1);
      assert.strictEqual(report.collisions[0].templateKey, 'layouts/base.hbs');
    });

    it('should be extension-agnostic', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      const dir2 = path.join(FIXTURES_DIR, 'stack2');
      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });
      
      await fs.writeFile(path.join(dir1, 'page.html'), 'v1');
      await fs.writeFile(path.join(dir1, 'post.njk'), 'v1');
      await fs.writeFile(path.join(dir1, 'style.css'), 'v1');
      await fs.writeFile(path.join(dir2, 'page.html'), 'v2');

      const report = await detectTemplateCollisions([dir1, dir2]);

      assert.strictEqual(report.totalTemplates, 3);
      assert.strictEqual(report.collisionCount, 1);
      assert.strictEqual(report.collisions[0].templateKey, 'page.html');
    });

    it('should handle three-way collisions', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      const dir2 = path.join(FIXTURES_DIR, 'stack2');
      const dir3 = path.join(FIXTURES_DIR, 'stack3');
      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });
      await fs.mkdir(dir3, { recursive: true });
      
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'v1');
      await fs.writeFile(path.join(dir2, 'page.hbs'), 'v2');
      await fs.writeFile(path.join(dir3, 'page.hbs'), 'v3');

      const report = await detectTemplateCollisions([dir1, dir2, dir3]);

      assert.strictEqual(report.collisionCount, 1);
      assert.strictEqual(report.collisions[0].sources.length, 3);
      assert.strictEqual(report.collisions[0].winner, dir3); // Last wins
    });

    it('should skip hidden directories and node_modules', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      await fs.mkdir(path.join(dir1, '.git'), { recursive: true });
      await fs.mkdir(path.join(dir1, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(dir1, '.git', 'config'), 'git');
      await fs.writeFile(path.join(dir1, 'node_modules', 'lib.js'), 'lib');
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'page');

      const report = await detectTemplateCollisions([dir1]);

      assert.strictEqual(report.totalTemplates, 1);
      assert.strictEqual(report.collisions[0]?.templateKey !== '.git/config', true);
      assert.strictEqual(report.collisions[0]?.templateKey !== 'node_modules/lib.js', true);
    });

    it('should handle non-existent directories gracefully', async () => {
      const nonExistent = path.join(FIXTURES_DIR, 'does-not-exist');

      const report = await detectTemplateCollisions([nonExistent]);

      assert.strictEqual(report.totalTemplates, 0);
      assert.strictEqual(report.collisionCount, 0);
    });

    it('should handle mix of existing and non-existing directories', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      const dir2 = path.join(FIXTURES_DIR, 'does-not-exist');
      await fs.mkdir(dir1, { recursive: true });
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'content');

      const report = await detectTemplateCollisions([dir1, dir2]);

      assert.strictEqual(report.totalTemplates, 1);
      assert.strictEqual(report.collisionCount, 0);
    });
  });

  describe('formatCollisionReport', () => {
    it('should format no-collision report', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      await fs.mkdir(dir1, { recursive: true });
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'content');

      const report = await detectTemplateCollisions([dir1]);
      const lines = formatCollisionReport(report, { verbose: true });

      assert.ok(lines.length > 0);
      assert.ok(lines[0].includes('unique templates'));
      assert.ok(lines[0].includes('no collisions'));
    });

    it('should format collision report with details', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      const dir2 = path.join(FIXTURES_DIR, 'stack2');
      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });
      
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'v1');
      await fs.writeFile(path.join(dir2, 'page.hbs'), 'v2');

      const report = await detectTemplateCollisions([dir1, dir2]);
      const lines = formatCollisionReport(report);

      assert.ok(lines.length > 0);
      assert.ok(lines.some(l => l.includes('collision')));
      assert.ok(lines.some(l => l.includes('page.hbs')));
      assert.ok(lines.some(l => l.includes('USED')));
      assert.ok(lines.some(l => l.includes('overridden')));
      assert.ok(lines.some(l => l.includes('--allow-template-collisions')));
    });

    it('should not show details when verbose=false and no collisions', async () => {
      const dir1 = path.join(FIXTURES_DIR, 'stack1');
      await fs.mkdir(dir1, { recursive: true });
      await fs.writeFile(path.join(dir1, 'page.hbs'), 'content');

      const report = await detectTemplateCollisions([dir1]);
      const lines = formatCollisionReport(report, { verbose: false });

      assert.strictEqual(lines.length, 0);
    });
  });
});
