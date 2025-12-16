/**
 * Tests for Generic Helpers
 * 
 * Comprehensive test suite for all generic template helpers.
 * These helpers are pure functions that work identically across all template engines.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { genericHelpers } from '../src/template_helpers/generic/index.js';

describe('Generic Helpers', () => {
  describe('Comparison', () => {
    it('eq - should check equality', () => {
      assert.equal(genericHelpers.eq(1, 1), true);
      assert.equal(genericHelpers.eq(1, 2), false);
      assert.equal(genericHelpers.eq('a', 'a'), true);
      assert.equal(genericHelpers.eq('a', 'b'), false);
      assert.equal(genericHelpers.eq(true, true), true);
      assert.equal(genericHelpers.eq(null, null), true);
    });

    it('ne - should check inequality', () => {
      assert.equal(genericHelpers.ne(1, 2), true);
      assert.equal(genericHelpers.ne(1, 1), false);
      assert.equal(genericHelpers.ne('a', 'b'), true);
      assert.equal(genericHelpers.ne('a', 'a'), false);
    });

    it('lt - should check less than', () => {
      assert.equal(genericHelpers.lt(1, 2), true);
      assert.equal(genericHelpers.lt(2, 1), false);
      assert.equal(genericHelpers.lt(1, 1), false);
    });

    it('lte - should check less than or equal', () => {
      assert.equal(genericHelpers.lte(1, 2), true);
      assert.equal(genericHelpers.lte(1, 1), true);
      assert.equal(genericHelpers.lte(2, 1), false);
    });

    it('gt - should check greater than', () => {
      assert.equal(genericHelpers.gt(2, 1), true);
      assert.equal(genericHelpers.gt(1, 2), false);
      assert.equal(genericHelpers.gt(1, 1), false);
    });

    it('gte - should check greater than or equal', () => {
      assert.equal(genericHelpers.gte(2, 1), true);
      assert.equal(genericHelpers.gte(1, 1), true);
      assert.equal(genericHelpers.gte(1, 2), false);
    });

    it('and - should perform logical AND', () => {
      assert.equal(genericHelpers.and(true, true, true), true);
      assert.equal(genericHelpers.and(true, false, true), false);
      assert.equal(genericHelpers.and(1, 'yes', {}), true);
      assert.equal(genericHelpers.and(1, '', {}), false);
      assert.equal(genericHelpers.and(0, 1), false);
    });

    it('or - should perform logical OR', () => {
      assert.equal(genericHelpers.or(false, false, true), true);
      assert.equal(genericHelpers.or(false, false, false), false);
      assert.equal(genericHelpers.or(0, '', 'yes'), true);
      assert.equal(genericHelpers.or(null, undefined, 1), true);
    });

    it('not - should invert boolean', () => {
      assert.equal(genericHelpers.not(true), false);
      assert.equal(genericHelpers.not(false), true);
      assert.equal(genericHelpers.not(0), true);
      assert.equal(genericHelpers.not(1), false);
      assert.equal(genericHelpers.not(''), true);
      assert.equal(genericHelpers.not('hello'), false);
    });
  });

  describe('Strings', () => {
    it('lowercase - should convert to lowercase', () => {
      assert.equal(genericHelpers.lowercase('HELLO'), 'hello');
      assert.equal(genericHelpers.lowercase('Hello World'), 'hello world');
      assert.equal(genericHelpers.lowercase('hello'), 'hello');
      assert.equal(genericHelpers.lowercase(null), '');
      assert.equal(genericHelpers.lowercase(undefined), '');
    });

    it('uppercase - should convert to uppercase', () => {
      assert.equal(genericHelpers.uppercase('hello'), 'HELLO');
      assert.equal(genericHelpers.uppercase('Hello World'), 'HELLO WORLD');
      assert.equal(genericHelpers.uppercase('HELLO'), 'HELLO');
      assert.equal(genericHelpers.uppercase(null), '');
    });

    it('capitalize - should capitalize first letter', () => {
      assert.equal(genericHelpers.capitalize('hello'), 'Hello');
      assert.equal(genericHelpers.capitalize('hello world'), 'Hello world');
      assert.equal(genericHelpers.capitalize('HELLO'), 'HELLO');
      assert.equal(genericHelpers.capitalize(''), '');
    });

    it('titleCase - should convert to title case', () => {
      assert.equal(genericHelpers.titleCase('hello world'), 'Hello World');
      assert.equal(genericHelpers.titleCase('hello_world'), 'Hello World');
      assert.equal(genericHelpers.titleCase('hello-world'), 'Hello World');
      assert.equal(genericHelpers.titleCase('hello world test'), 'Hello World Test');
    });

    it('slugify - should convert to slug', () => {
      assert.equal(genericHelpers.slugify('Hello World'), 'hello-world');
      assert.equal(genericHelpers.slugify('Hello  World!'), 'hello-world');
      assert.equal(genericHelpers.slugify('  hello world  '), 'hello-world');
      assert.equal(genericHelpers.slugify('test_with_underscores'), 'test-with-underscores');
    });

    it('trim - should trim whitespace', () => {
      assert.equal(genericHelpers.trim('  hello  '), 'hello');
      assert.equal(genericHelpers.trim('\n\thello\t\n'), 'hello');
      assert.equal(genericHelpers.trim('hello'), 'hello');
      assert.equal(genericHelpers.trim('  '), '');
    });

    it('split - should split string', () => {
      assert.deepEqual(genericHelpers.split('a,b,c', ','), ['a', 'b', 'c']);
      assert.equal(genericHelpers.split('a,b,c', ',', 0), 'a');
      assert.equal(genericHelpers.split('a,b,c', ',', 1), 'b');
      assert.equal(genericHelpers.split('a,b,c', ',', 5), '');
      assert.deepEqual(genericHelpers.split('a-b-c', '-'), ['a', 'b', 'c']);
    });

    it('replace - should replace occurrences', () => {
      assert.equal(genericHelpers.replace('hello world', 'world', 'there'), 'hello there');
      assert.equal(genericHelpers.replace('a-b-c', '-', '_'), 'a_b_c');
      assert.equal(genericHelpers.replace('test test', 'test', 'result'), 'result result');
    });

    it('substring - should extract substring', () => {
      assert.equal(genericHelpers.substring('hello', 0, 2), 'he');
      assert.equal(genericHelpers.substring('hello', 2), 'llo');
      assert.equal(genericHelpers.substring('hello', 1, 4), 'ell');
      assert.equal(genericHelpers.substring('hello', 5), '');
    });

    it('escape - should escape HTML special characters', () => {
      assert.equal(genericHelpers.escape('<div>'), '&lt;div&gt;');
      assert.equal(genericHelpers.escape('a & b'), 'a &amp; b');
      assert.equal(genericHelpers.escape('"quoted"'), '&quot;quoted&quot;');
    });
  });

  describe('Collections', () => {
    it('where - should filter by property', () => {
      const items = [
        { name: 'a', type: 'foo' },
        { name: 'b', type: 'bar' },
        { name: 'c', type: 'foo' }
      ];
      
      const result = genericHelpers.where(items, 'type', 'foo');
      assert.equal(result.length, 2);
      assert.equal(result[0].name, 'a');
      assert.equal(result[1].name, 'c');
    });

    it('where - should handle nested paths', () => {
      const items = [
        { name: 'a', config: { env: 'dev' } },
        { name: 'b', config: { env: 'prod' } },
        { name: 'c', config: { env: 'dev' } }
      ];
      
      const result = genericHelpers.where(items, 'config.env', 'dev');
      assert.equal(result.length, 2);
    });

    it('whereIncludes - should filter by array inclusion', () => {
      const items = [
        { name: 'a', tags: ['foo', 'bar'] },
        { name: 'b', tags: ['baz'] },
        { name: 'c', tags: ['foo'] }
      ];
      
      const result = genericHelpers.whereIncludes(items, 'tags', 'foo');
      assert.equal(result.length, 2);
      assert.equal(result[0].name, 'a');
      assert.equal(result[1].name, 'c');
    });

    it('sortBy - should sort by property', () => {
      const items = [
        { name: 'charlie', age: 30 },
        { name: 'alice', age: 25 },
        { name: 'bob', age: 35 }
      ];
      
      const result = genericHelpers.sortBy(items, 'name');
      assert.equal(result[0].name, 'alice');
      assert.equal(result[1].name, 'bob');
      assert.equal(result[2].name, 'charlie');
    });

    it('sortBy - should handle reverse option', () => {
      const items = [
        { value: 1 },
        { value: 3 },
        { value: 2 }
      ];
      
      const result = genericHelpers.sortBy(items, 'value', { reverse: true });
      assert.equal(result[0].value, 3);
      assert.equal(result[1].value, 2);
      assert.equal(result[2].value, 1);
    });

    it('pluck - should extract property values', () => {
      const items = [
        { name: 'a', value: 1 },
        { name: 'b', value: 2 },
        { name: 'c', value: 3 }
      ];
      
      const result = genericHelpers.pluck(items, 'value');
      assert.deepEqual(result, [1, 2, 3]);
    });

    it('flatten - should flatten array', () => {
      const nested = [[1, 2], [3, 4], [5]];
      const result = genericHelpers.flatten(nested);
      assert.deepEqual(result, [1, 2, 3, 4, 5]);
    });

    it('unique - should remove duplicates', () => {
      const items = [1, 2, 2, 3, 1, 4];
      const result = genericHelpers.unique(items);
      assert.deepEqual(result, [1, 2, 3, 4]);
    });

    it('groupBy - should group by property', () => {
      const items = [
        { name: 'a', type: 'foo' },
        { name: 'b', type: 'bar' },
        { name: 'c', type: 'foo' }
      ];
      
      const result = genericHelpers.groupBy(items, 'type');
      assert.equal(result.length, 2);
      assert.equal(result[0].key, 'bar');
      assert.equal(result[0].items.length, 1);
      assert.equal(result[1].key, 'foo');
      assert.equal(result[1].items.length, 2);
    });

    it('first - should get first item', () => {
      assert.equal(genericHelpers.first([1, 2, 3]), 1);
      assert.equal(genericHelpers.first([]), undefined);
      assert.equal(genericHelpers.first(['a', 'b']), 'a');
    });

    it('last - should get last item', () => {
      assert.equal(genericHelpers.last([1, 2, 3]), 3);
      assert.equal(genericHelpers.last([]), undefined);
      assert.equal(genericHelpers.last(['a', 'b']), 'b');
    });

    it('reverse - should reverse array', () => {
      assert.deepEqual(genericHelpers.reverse([1, 2, 3]), [3, 2, 1]);
      assert.deepEqual(genericHelpers.reverse(['a', 'b', 'c']), ['c', 'b', 'a']);
    });

    it('compact - should remove falsy values', () => {
      assert.deepEqual(genericHelpers.compact([1, 0, null, 2, '', 3]), [1, 2, 3]);
      assert.deepEqual(genericHelpers.compact([false, true, undefined, 'yes']), [true, 'yes']);
    });

    it('length - should get length', () => {
      assert.equal(genericHelpers.length([1, 2, 3]), 3);
      assert.equal(genericHelpers.length({ a: 1, b: 2 }), 2);
      assert.equal(genericHelpers.length('hello'), 5);
      assert.equal(genericHelpers.length(null), 0);
      assert.equal(genericHelpers.length([]), 0);
    });
  });

  describe('Utility', () => {
    it('defaultTo - should return default if null/undefined', () => {
      assert.equal(genericHelpers.defaultTo(null, 'default'), 'default');
      assert.equal(genericHelpers.defaultTo(undefined, 'default'), 'default');
      assert.equal(genericHelpers.defaultTo(0, 'default'), 0);
      assert.equal(genericHelpers.defaultTo('', 'default'), '');
      assert.equal(genericHelpers.defaultTo(false, 'default'), false);
    });

    it('array - should create array from arguments', () => {
      assert.deepEqual(genericHelpers.array(1, 2, 3), [1, 2, 3]);
      assert.deepEqual(genericHelpers.array('a', 'b'), ['a', 'b']);
      assert.deepEqual(genericHelpers.array(), []);
    });

    it('identity - should return input', () => {
      assert.equal(genericHelpers.identity(42), 42);
      assert.deepEqual(genericHelpers.identity({ a: 1 }), { a: 1 });
      assert.equal(genericHelpers.identity('test'), 'test');
    });

    it('json - should serialize to JSON', () => {
      const obj = { name: 'test', value: 42 };
      const result = genericHelpers.json(obj);
      assert.match(result, /"name": "test"/);
      assert.match(result, /"value": 42/);
    });

    it('concat - should concatenate arguments', () => {
      assert.equal(genericHelpers.concat('a', 'b', 'c'), 'abc');
      assert.equal(genericHelpers.concat('hello', ' ', 'world'), 'hello world');
      assert.equal(genericHelpers.concat(1, 2, 3), '123');
    });

    it('isArray - should check if array', () => {
      assert.equal(genericHelpers.isArray([]), true);
      assert.equal(genericHelpers.isArray([1, 2, 3]), true);
      assert.equal(genericHelpers.isArray({}), false);
      assert.equal(genericHelpers.isArray('string'), false);
      assert.equal(genericHelpers.isArray(null), false);
    });

    it('isObject - should check if object', () => {
      assert.equal(genericHelpers.isObject({}), true);
      assert.equal(genericHelpers.isObject({ a: 1 }), true);
      assert.equal(genericHelpers.isObject([]), false);
      assert.equal(genericHelpers.isObject(null), false);
      assert.equal(genericHelpers.isObject('string'), false);
    });

    it('isString - should check if string', () => {
      assert.equal(genericHelpers.isString('hello'), true);
      assert.equal(genericHelpers.isString(''), true);
      assert.equal(genericHelpers.isString(123), false);
      assert.equal(genericHelpers.isString(null), false);
    });

    it('isNumber - should check if number', () => {
      assert.equal(genericHelpers.isNumber(123), true);
      assert.equal(genericHelpers.isNumber(0), true);
      assert.equal(genericHelpers.isNumber(-5.5), true);
      assert.equal(genericHelpers.isNumber('123'), false);
      assert.equal(genericHelpers.isNumber(NaN), false);
    });

    it('isBoolean - should check if boolean', () => {
      assert.equal(genericHelpers.isBoolean(true), true);
      assert.equal(genericHelpers.isBoolean(false), true);
      assert.equal(genericHelpers.isBoolean(1), false);
      assert.equal(genericHelpers.isBoolean('true'), false);
    });

    it('isNil - should check if null/undefined', () => {
      assert.equal(genericHelpers.isNil(null), true);
      assert.equal(genericHelpers.isNil(undefined), true);
      assert.equal(genericHelpers.isNil(0), false);
      assert.equal(genericHelpers.isNil(''), false);
      assert.equal(genericHelpers.isNil(false), false);
    });

    it('typeOf - should return type', () => {
      assert.equal(genericHelpers.typeOf([]), 'array');
      assert.equal(genericHelpers.typeOf({}), 'object');
      assert.equal(genericHelpers.typeOf(''), 'string');
      assert.equal(genericHelpers.typeOf(123), 'number');
      assert.equal(genericHelpers.typeOf(null), 'null');
      assert.equal(genericHelpers.typeOf(undefined), 'undefined');
      assert.equal(genericHelpers.typeOf(true), 'boolean');
    });
  });
});
