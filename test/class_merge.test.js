/**
 * Deep merge tests for field defaults
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classMerge } from '../src/utils/class_merge.js';
import { ClassLoader } from '../src/class_loader.js';
import { ClassResolver } from '../src/class_resolver.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Deep Merge Utility', () => {
  it('should merge flat objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = classMerge(target, source);
    
    assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 });
  });

  it('should deep merge nested objects', () => {
    const target = {
      config: {
        timeout: 30,
        retries: 3
      }
    };
    const source = {
      config: {
        timeout: 60
      }
    };
    const result = classMerge(target, source);
    
    assert.deepStrictEqual(result, {
      config: {
        timeout: 60,
        retries: 3  // Preserved from target
      }
    });
  });

  it('should replace arrays (not merge)', () => {
    const target = { tags: ['a', 'b'] };
    const source = { tags: ['c', 'd'] };
    const result = classMerge(target, source);
    
    assert.deepStrictEqual(result, { tags: ['c', 'd'] });
  });

  it('should handle multiple levels of nesting', () => {
    const target = {
      server: {
        http: {
          port: 8080,
          host: 'localhost'
        }
      }
    };
    const source = {
      server: {
        http: {
          port: 3000
        },
        https: {
          port: 443
        }
      }
    };
    const result = classMerge(target, source);
    
    assert.deepStrictEqual(result, {
      server: {
        http: {
          port: 3000,
          host: 'localhost'
        },
        https: {
          port: 443
        }
      }
    });
  });
});

describe('Class Field Deep Merging', async () => {
  const testDir = path.join(__dirname, 'fixtures', 'deep_merge');

  // Setup - create test fixtures
  await (async () => {
    // Create test classes with nested field defaults
    await fs.mkdir(testDir, { recursive: true });

    // Base class with nested defaults
    await fs.writeFile(
      path.join(testDir, 'base.class.json'),
      JSON.stringify({
        $class: 'base',
        $schema: {
          type: 'object',
          properties: {
            $id: { type: 'string' }
          }
        },
        $fields: {
          config: {
            timeout: 30,
            retries: 3,
            logging: {
              level: 'info',
              format: 'json'
            }
          }
        }
      })
    );

    // Child class overrides some nested fields
    await fs.writeFile(
      path.join(testDir, 'child.class.json'),
      JSON.stringify({
        $class: 'child',
        $parent: 'base',
        $schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        },
        $fields: {
          config: {
            timeout: 60,
            logging: {
              level: 'debug'
            }
          }
        }
      })
    );

    // Grandchild class adds more nested config
    await fs.writeFile(
      path.join(testDir, 'grandchild.class.json'),
      JSON.stringify({
        $class: 'grandchild',
        $parent: 'child',
        $schema: {
          type: 'object'
        },
        $fields: {
          config: {
            logging: {
              destination: '/var/log/app.log'
            }
          }
        }
      })
    );
  })();

  it('should deep merge nested field defaults across inheritance', async () => {
    const classLoader = new ClassLoader();
    await classLoader.loadClassesFromDirectory(testDir);

    const resolver = new ClassResolver(classLoader);
    const resolved = resolver.resolve('grandchild');

    // Expected: deep merge of all three levels
    assert.deepStrictEqual(resolved.$fields, {
      config: {
        timeout: 60,        // From child (overrides base)
        retries: 3,         // From base (preserved)
        logging: {
          level: 'debug',   // From child (overrides base)
          format: 'json',   // From base (preserved)
          destination: '/var/log/app.log'  // From grandchild (added)
        }
      }
    });
  });

  it('should handle child without nested config', async () => {
    // Create a class that doesn't define nested config
    await fs.writeFile(
      path.join(testDir, 'simple.class.json'),
      JSON.stringify({
        $class: 'simple',
        $parent: 'base',
        $schema: { type: 'object' },
        $fields: {
          simple_field: 'value'
        }
      })
    );

    const classLoader = new ClassLoader();
    await classLoader.loadClassesFromDirectory(testDir);

    const resolver = new ClassResolver(classLoader);
    const resolved = resolver.resolve('simple');

    // Should preserve base's nested config
    assert.deepStrictEqual(resolved.$fields.config, {
      timeout: 30,
      retries: 3,
      logging: {
        level: 'info',
        format: 'json'
      }
    });
    
    assert.strictEqual(resolved.$fields.simple_field, 'value');
  });
});
