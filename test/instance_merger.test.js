import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeInstances, getMergeStats } from '../src/instance_merger.js';

describe('Instance Merger', () => {
  describe('mergeInstances', () => {
    it('should keep separate instances as-is', () => {
      const instances = [
        { $id: 'a', $class: 'type1', value: 1, $source_file: 'a.json' },
        { $id: 'b', $class: 'type2', value: 2, $source_file: 'b.json' }
      ];

      const merged = mergeInstances(instances);
      assert.equal(merged.length, 2);
      assert.equal(merged[0].$id, 'a');
      assert.equal(merged[1].$id, 'b');
    });

    it('should merge instances with same ID', () => {
      const instances = [
        { $id: 'x', $class: 'page', title: 'Base', tags: ['one'], $source_file: 'base.json' },
        { $id: 'x', $class: 'page', description: 'Extended', tags: ['two'], $source_file: 'ext.json' }
      ];

      const merged = mergeInstances(instances);
      assert.equal(merged.length, 1);
      assert.equal(merged[0].$id, 'x');
      assert.equal(merged[0].title, 'Base');
      assert.equal(merged[0].description, 'Extended');
      assert.deepEqual(merged[0].tags, ['one', 'two']);
      assert.deepEqual(merged[0].$merged_from, ['base.json', 'ext.json']);
    });

    it('should dedupe array primitives', () => {
      const instances = [
        { $id: 'x', $class: 'page', tags: ['a', 'b'], $source_file: '1.json' },
        { $id: 'x', $class: 'page', tags: ['b', 'c'], $source_file: '2.json' }
      ];

      const merged = mergeInstances(instances);
      assert.deepEqual(merged[0].tags, ['a', 'b', 'c']);
    });

    it('should keep all array objects (no dedup)', () => {
      const instances = [
        { $id: 'x', $class: 'page', items: [{ name: 'a' }], $source_file: '1.json' },
        { $id: 'x', $class: 'page', items: [{ name: 'a' }], $source_file: '2.json' }
      ];

      const merged = mergeInstances(instances);
      assert.equal(merged[0].items.length, 2);
    });

    it('should fail on class mismatch', () => {
      const instances = [
        { $id: 'x', $class: 'type1', $source_file: 'a.json' },
        { $id: 'x', $class: 'type2', $source_file: 'b.json' }
      ];

      assert.throws(
        () => mergeInstances(instances),
        /conflicting classes/
      );
    });

    it('should fail on type conflicts', () => {
      const instances = [
        { $id: 'x', $class: 'page', value: 'string', $source_file: 'a.json' },
        { $id: 'x', $class: 'page', value: 123, $source_file: 'b.json' }
      ];

      assert.throws(
        () => mergeInstances(instances),
        /Type conflict/
      );
    });

    it('should deep merge nested objects', () => {
      const instances = [
        { $id: 'x', $class: 'page', meta: { author: 'Alice', date: '2025-01-01' }, $source_file: '1.json' },
        { $id: 'x', $class: 'page', meta: { tags: ['featured'] }, $source_file: '2.json' }
      ];

      const merged = mergeInstances(instances);
      assert.deepEqual(merged[0].meta, {
        author: 'Alice',
        date: '2025-01-01',
        tags: ['featured']
      });
    });

    it('should handle scalars last-wins', () => {
      const instances = [
        { $id: 'x', $class: 'page', title: 'First', $source_file: '1.json' },
        { $id: 'x', $class: 'page', title: 'Second', $source_file: '2.json' }
      ];

      const merged = mergeInstances(instances);
      assert.equal(merged[0].title, 'Second');
    });
  });

  describe('getMergeStats', () => {
    it('should calculate merge statistics', () => {
      const original = [
        { $id: 'a', $class: 'page', $source_file: '1.json' },
        { $id: 'b', $class: 'page', $source_file: '2.json' },
        { $id: 'a', $class: 'page', $source_file: '3.json' }
      ];

      const merged = mergeInstances(original);
      const stats = getMergeStats(original, merged);

      assert.equal(stats.totalSources, 3);
      assert.equal(stats.uniqueInstances, 2);
      assert.equal(stats.mergedCount, 1);
      assert.equal(stats.reduction, 1);
    });
  });
});
