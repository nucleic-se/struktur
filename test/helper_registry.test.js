/**
 * Tests for Template Helper Registry
 * 
 * Tests the helper registration and management system.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HelperRegistry } from '../src/template_helpers/index.js';

describe('HelperRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new HelperRegistry();
  });

  describe('register', () => {
    it('should register a helper', () => {
      const fn = (a, b) => a + b;
      registry.register('add', fn);

      assert.equal(registry.has('add'), true);
      const helper = registry.get('add');
      assert.equal(helper.name, 'add');
      assert.equal(helper.fn, fn);
    });

    it('should default to generic category', () => {
      registry.register('test', () => {});
      const helper = registry.get('test');
      assert.equal(helper.category, 'generic');
    });

    it('should support custom category', () => {
      registry.register('inherits', () => {}, { category: 'struktur' });
      const helper = registry.get('inherits');
      assert.equal(helper.category, 'struktur');
    });

    it('should track requiresContext flag', () => {
      registry.register('test', () => {}, { requiresContext: true });
      const helper = registry.get('test');
      assert.equal(helper.requiresContext, true);
    });

    it('should track requiresBuildContext flag', () => {
      registry.register('test', () => {}, { requiresBuildContext: true });
      const helper = registry.get('test');
      assert.equal(helper.requiresBuildContext, true);
    });

    it('should store description', () => {
      registry.register('test', () => {}, { description: 'Test helper' });
      const helper = registry.get('test');
      assert.equal(helper.description, 'Test helper');
    });

    it('should throw error for duplicate registration', () => {
      registry.register('test', () => {});
      
      assert.throws(
        () => registry.register('test', () => {}),
        /already registered/
      );
    });

    it('should return registry for chaining', () => {
      const result = registry.register('test', () => {});
      assert.equal(result, registry);
    });
  });

  describe('registerMany', () => {
    it('should register multiple helpers', () => {
      const helpers = {
        add: (a, b) => a + b,
        subtract: (a, b) => a - b,
        multiply: (a, b) => a * b
      };

      registry.registerMany(helpers);

      assert.equal(registry.has('add'), true);
      assert.equal(registry.has('subtract'), true);
      assert.equal(registry.has('multiply'), true);
    });

    it('should apply options to all helpers', () => {
      const helpers = {
        eq: (a, b) => a === b,
        ne: (a, b) => a !== b
      };

      registry.registerMany(helpers, { 
        category: 'generic',
        description: 'Comparison helper'
      });

      assert.equal(registry.get('eq').category, 'generic');
      assert.equal(registry.get('ne').category, 'generic');
      assert.equal(registry.get('eq').description, 'Comparison helper');
      assert.equal(registry.get('ne').description, 'Comparison helper');
    });

    it('should return registry for chaining', () => {
      const result = registry.registerMany({ test: () => {} });
      assert.equal(result, registry);
    });
  });

  describe('get', () => {
    it('should return helper definition', () => {
      const fn = () => 'test';
      registry.register('test', fn, { category: 'generic' });

      const helper = registry.get('test');
      assert.equal(helper.name, 'test');
      assert.equal(helper.fn, fn);
      assert.equal(helper.category, 'generic');
    });

    it('should return undefined for unknown helper', () => {
      assert.equal(registry.get('unknown'), undefined);
    });
  });

  describe('has', () => {
    it('should return true for registered helper', () => {
      registry.register('test', () => {});
      assert.equal(registry.has('test'), true);
    });

    it('should return false for unregistered helper', () => {
      assert.equal(registry.has('unknown'), false);
    });
  });

  describe('getCategory', () => {
    it('should return helpers in category', () => {
      registry.register('eq', () => {}, { category: 'generic' });
      registry.register('inherits', () => {}, { category: 'struktur' });
      registry.register('render_file', () => {}, { category: 'engine' });

      const genericHelpers = registry.getCategory('generic');
      assert.equal(genericHelpers.length, 1);
      assert.equal(genericHelpers[0].name, 'eq');

      const strukturHelpers = registry.getCategory('struktur');
      assert.equal(strukturHelpers.length, 1);
      assert.equal(strukturHelpers[0].name, 'inherits');
    });

    it('should return empty array for unknown category', () => {
      const helpers = registry.getCategory('unknown');
      assert.equal(Array.isArray(helpers), true);
      assert.equal(helpers.length, 0);
    });

    it('should return empty array for empty category', () => {
      const helpers = registry.getCategory('generic');
      assert.equal(helpers.length, 0);
    });
  });

  describe('getAllNames', () => {
    it('should return all helper names', () => {
      registry.register('eq', () => {});
      registry.register('where', () => {});
      registry.register('inherits', () => {});

      const names = registry.getAllNames();
      assert.equal(names.length, 3);
      assert.equal(names.includes('eq'), true);
      assert.equal(names.includes('where'), true);
      assert.equal(names.includes('inherits'), true);
    });

    it('should return empty array when no helpers', () => {
      const names = registry.getAllNames();
      assert.equal(names.length, 0);
    });
  });

  describe('registerToAdapter', () => {
    it('should register all helpers to adapter', () => {
      const registeredHelpers = {};
      const mockAdapter = {
        registerHelper: (name, fn) => {
          registeredHelpers[name] = fn;
        }
      };

      registry.register('test1', () => 'a');
      registry.register('test2', () => 'b');

      registry.registerToAdapter(mockAdapter);

      assert.equal(registeredHelpers.test1(), 'a');
      assert.equal(registeredHelpers.test2(), 'b');
    });

    it('should bind context for context-requiring helpers', () => {
      const registeredHelpers = {};
      const mockAdapter = {
        registerHelper: (name, fn) => {
          registeredHelpers[name] = fn;
        }
      };

      const helper = (context, value) => context.prefix + value;
      registry.register('prefixed', helper, { requiresContext: true });

      const context = { prefix: 'test_' };
      registry.registerToAdapter(mockAdapter, context);

      assert.equal(registeredHelpers.prefixed('value'), 'test_value');
    });

    it('should bind build context for build-requiring helpers', () => {
      const registeredHelpers = {};
      const mockAdapter = {
        registerHelper: (name, fn) => {
          registeredHelpers[name] = fn;
        }
      };

      const helper = (buildCtx, filename) => buildCtx.buildDir + '/' + filename;
      registry.register('build_path', helper, { requiresBuildContext: true });

      const buildContext = { buildDir: '/tmp/build' };
      registry.registerToAdapter(mockAdapter, {}, buildContext);

      assert.equal(registeredHelpers.build_path('test.html'), '/tmp/build/test.html');
    });

    it('should return registry for chaining', () => {
      const mockAdapter = { registerHelper: () => {} };
      const result = registry.registerToAdapter(mockAdapter);
      assert.equal(result, registry);
    });
  });

  describe('clear', () => {
    it('should remove all registered helpers', () => {
      registry.register('test1', () => {});
      registry.register('test2', () => {});

      assert.equal(registry.has('test1'), true);
      assert.equal(registry.has('test2'), true);

      registry.clear();

      assert.equal(registry.has('test1'), false);
      assert.equal(registry.has('test2'), false);
    });

    it('should reset categories', () => {
      registry.register('test', () => {}, { category: 'generic' });
      
      assert.equal(registry.getCategory('generic').length, 1);
      
      registry.clear();
      
      assert.equal(registry.getCategory('generic').length, 0);
    });
  });

  describe('stats', () => {
    it('should return statistics about registered helpers', () => {
      registry.register('eq', () => {}, { category: 'generic' });
      registry.register('ne', () => {}, { category: 'generic' });
      registry.register('inherits', () => {}, { category: 'struktur' });
      registry.register('render_file', () => {}, { category: 'engine' });

      const stats = registry.stats();
      
      assert.equal(stats.total, 4);
      assert.equal(stats.generic, 2);
      assert.equal(stats.struktur, 1);
      assert.equal(stats.engine, 1);
    });

    it('should return zero stats for empty registry', () => {
      const stats = registry.stats();
      
      assert.equal(stats.total, 0);
      assert.equal(stats.generic, 0);
      assert.equal(stats.struktur, 0);
      assert.equal(stats.engine, 0);
    });
  });

  describe('Categories Organization', () => {
    it('should organize helpers by category', () => {
      registry.register('eq', () => {}, { category: 'generic' });
      registry.register('where', () => {}, { category: 'generic' });
      registry.register('inherits', () => {}, { category: 'struktur' });
      registry.register('schema_required', () => {}, { category: 'struktur' });
      registry.register('render_file', () => {}, { category: 'engine' });

      assert.equal(registry.getCategory('generic').length, 2);
      assert.equal(registry.getCategory('struktur').length, 2);
      assert.equal(registry.getCategory('engine').length, 1);
    });

    it('should handle helpers with same name in different registries', () => {
      const registry1 = new HelperRegistry();
      const registry2 = new HelperRegistry();

      registry1.register('test', () => 'registry1');
      registry2.register('test', () => 'registry2');

      assert.equal(registry1.get('test').fn(), 'registry1');
      assert.equal(registry2.get('test').fn(), 'registry2');
    });
  });
});
