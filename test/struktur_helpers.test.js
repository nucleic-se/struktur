/**
 * Tests for struktur-specific template helpers
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as strukturSchema from '../src/template_helpers/struktur/schema.js';
import * as strukturInheritance from '../src/template_helpers/struktur/inheritance.js';

describe('Struktur Helpers - Schema', () => {
  const mockContext = {
    $classes_by_id: {
      'base': {
        $lineage: ['base'],
        $schemas: [
          {
            properties: {
              $id: { type: 'string' },
              name: { type: 'string' }
            },
            required: ['$id']
          }
        ]
      },
      'child': {
        $lineage: ['child', 'base'],
        $schemas: [
          {
            properties: {
              description: { type: 'string' }
            },
            required: ['description']
          },
          {
            properties: {
              $id: { type: 'string' },
              name: { type: 'string' }
            },
            required: ['$id']
          }
        ]
      }
    }
  };

  it('schemaRequired - should detect required fields', () => {
    assert.equal(strukturSchema.schemaRequired(mockContext, 'base', '$id'), true);
    assert.equal(strukturSchema.schemaRequired(mockContext, 'base', 'name'), false);
    assert.equal(strukturSchema.schemaRequired(mockContext, 'child', 'description'), true);
    assert.equal(strukturSchema.schemaRequired(mockContext, 'child', '$id'), true); // inherited
  });

  it('schemaHas - should detect property existence', () => {
    assert.equal(strukturSchema.schemaHas(mockContext, 'base', '$id'), true);
    assert.equal(strukturSchema.schemaHas(mockContext, 'base', 'name'), true);
    assert.equal(strukturSchema.schemaHas(mockContext, 'base', 'nonexistent'), false);
    assert.equal(strukturSchema.schemaHas(mockContext, 'child', '$id'), true); // inherited
    assert.equal(strukturSchema.schemaHas(mockContext, 'child', 'description'), true);
  });

  it('schemaProps - should return all properties including inherited', () => {
    const baseProps = strukturSchema.schemaProps(mockContext, 'base');
    assert.deepEqual(baseProps, ['$id', 'name']);

    const childProps = strukturSchema.schemaProps(mockContext, 'child');
    assert.deepEqual(childProps, ['$id', 'description', 'name']); // sorted
  });

  it('schemaPropSource - should find which class defines a property', () => {
    assert.equal(strukturSchema.schemaPropSource(mockContext, 'child', 'description'), 'child');
    assert.equal(strukturSchema.schemaPropSource(mockContext, 'child', '$id'), 'base');
    assert.equal(strukturSchema.schemaPropSource(mockContext, 'child', 'nonexistent'), '');
  });

  it('schemaRequiredBySource - should group required fields by class', () => {
    const result = strukturSchema.schemaRequiredBySource(mockContext, 'child');
    assert.deepEqual(result, [
      { class: 'child', required: ['description'] },
      { class: 'base', required: ['$id'] }
    ]);
  });

  it('should handle missing class gracefully', () => {
    assert.equal(strukturSchema.schemaRequired(mockContext, 'nonexistent', 'field'), false);
    assert.equal(strukturSchema.schemaHas(mockContext, 'nonexistent', 'field'), false);
    assert.deepEqual(strukturSchema.schemaProps(mockContext, 'nonexistent'), []);
    assert.equal(strukturSchema.schemaPropSource(mockContext, 'nonexistent', 'field'), '');
  });
});

describe('Struktur Helpers - Inheritance', () => {
  const mockContext = {
    $classes_by_id: {
      'base': {
        $lineage: ['base']
      },
      'child': {
        $lineage: ['child', 'base']
      },
      'grandchild': {
        $lineage: ['grandchild', 'child', 'base']
      }
    }
  };

  it('inherits - should check single inheritance', () => {
    assert.equal(strukturInheritance.inherits(mockContext, 'child', 'base'), true);
    assert.equal(strukturInheritance.inherits(mockContext, 'child', 'child'), true);
    assert.equal(strukturInheritance.inherits(mockContext, 'base', 'child'), false);
  });

  it('inherits - should check multiple inheritance', () => {
    assert.equal(strukturInheritance.inherits(mockContext, 'grandchild', ['base', 'child']), true);
    assert.equal(strukturInheritance.inherits(mockContext, 'child', ['base', 'grandchild']), false);
  });

  it('classLineage - should return lineage array', () => {
    assert.deepEqual(strukturInheritance.classLineage(mockContext, 'grandchild'), 
      ['grandchild', 'child', 'base']);
    assert.deepEqual(strukturInheritance.classLineage(mockContext, 'base'), ['base']);
  });

  it('filterInherits - should filter instances by inheritance', () => {
    const instances = [
      { $id: 'a', $class: 'base' },
      { $id: 'b', $class: 'child' },
      { $id: 'c', $class: 'grandchild' },
      { $id: 'd', $class: 'other' }
    ];

    const filtered = strukturInheritance.filterInherits(mockContext, instances, 'base');
    assert.equal(filtered.length, 3); // base, child, grandchild all inherit from base
    assert.deepEqual(filtered.map(i => i.$id), ['a', 'b', 'c']);
  });

  it('filterInherits - should handle object input', () => {
    const instancesObj = {
      'a': { $id: 'a', $class: 'base' },
      'b': { $id: 'b', $class: 'child' }
    };

    const filtered = strukturInheritance.filterInherits(mockContext, instancesObj, 'base');
    assert.equal(filtered.length, 2);
  });

  it('should handle missing class gracefully', () => {
    assert.equal(strukturInheritance.inherits(mockContext, 'nonexistent', 'base'), false);
    assert.deepEqual(strukturInheritance.classLineage(mockContext, 'nonexistent'), []);
  });
});
