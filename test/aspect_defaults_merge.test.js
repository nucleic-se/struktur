/**
 * Tests for three-layer aspect defaults merge system
 * 
 * Tests the merge hierarchy:
 * 1. Aspect definition defaults (from .class.json files)
 * 2. Class $aspect_defaults (from class hierarchy)
 * 3. Instance values (highest priority)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createStruktur, generateCanonicalWithValidation } from '../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Aspect Defaults Three-Layer Merge', () => {
  let tempDir;
  let struktur;

  beforeEach(async () => {
    // Create temporary directory for test fixtures
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'struktur-test-'));
    struktur = createStruktur();
  });

  async function createTestFiles(files) {
    // Always create entity_base class first
    const entityBase = {
      $class: 'entity_base',
      $schema: {
        type: 'object',
        properties: {
          $id: { type: 'string' }
        },
        required: ['$id']
      }
    };
    
    const fullPath = path.join(tempDir, 'classes/entity_base.class.json');
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(entityBase, null, 2));
    
    // Create test-specific files
    for (const [filePath, content] of Object.entries(files)) {
      const testPath = path.join(tempDir, filePath);
      await fs.mkdir(path.dirname(testPath), { recursive: true });
      await fs.writeFile(testPath, JSON.stringify(content, null, 2));
    }
  }

  describe('Layer 1: Aspect Definition Defaults', () => {
    it('should apply defaults from aspect definition', async () => {
      await createTestFiles({
        'aspects/aspect_network.class.json': {
          $class: 'aspect_network',
          $aspect: 'aspect_network',
          $schema: {
            type: 'object',
            properties: {
              bridge: { type: 'string' },
              gateway: { type: 'string' }
            }
          },
          $defaults: {
            bridge: 'vmbr0',
            gateway: '192.168.1.1'
          }
        },
        'classes/server.class.json': {
          $class: 'server',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_network'],
          $schema: { type: 'object' }
        },
        'instances/test_server.json': {
          $id: 'test_server',
          $class: 'server',
          $aspects: {
            aspect_network: {
              ip: '192.168.1.100'
            }
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const server = canonical.$instances_by_id.test_server;
      assert.strictEqual(server.$aspects.aspect_network.ip, '192.168.1.100', 'Instance value present');
      assert.strictEqual(server.$aspects.aspect_network.bridge, 'vmbr0', 'Aspect default applied');
      assert.strictEqual(server.$aspects.aspect_network.gateway, '192.168.1.1', 'Aspect default applied');
    });

    it('should handle aspect definitions without defaults', async () => {
      await createTestFiles({
        'aspects/aspect_storage.class.json': {
          $class: 'aspect_storage',
          $aspect: 'aspect_storage',
          $schema: {
            type: 'object',
            properties: {
              size: { type: 'string' }
            }
          }
        },
        'classes/disk.class.json': {
          $class: 'disk',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_storage'],
          $schema: { type: 'object' }
        },
        'instances/test_disk.json': {
          $id: 'test_disk',
          $class: 'disk',
          $aspects: {
            aspect_storage: {
              size: '100G'
            }
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const disk = canonical.$instances_by_id.test_disk;
      assert.strictEqual(disk.$aspects.aspect_storage.size, '100G', 'Instance value present');
      assert.strictEqual(Object.keys(disk.$aspects.aspect_storage).length, 1, 'No extra defaults added');
    });
  });

  describe('Layer 2: Class Hierarchy $aspect_defaults', () => {
    it('should apply defaults from class $aspect_defaults', async () => {
      await createTestFiles({
        'aspects/aspect_proxmox.class.json': {
          $class: 'aspect_proxmox',
          $aspect: 'aspect_proxmox',
          $schema: {
            type: 'object',
            properties: {
              host_node: { type: 'string' },
              start: { type: 'boolean' },
              unprivileged: { type: 'boolean' }
            }
          }
        },
        'classes/lxc.class.json': {
          $class: 'lxc',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_proxmox'],
          $aspect_defaults: {
            aspect_proxmox: {
              host_node: 'pve-01',
              start: true,
              unprivileged: true
            }
          },
          $schema: { type: 'object' }
        },
        'instances/test_lxc.json': {
          $id: 'test_lxc',
          $class: 'lxc',
          $aspects: {
            aspect_proxmox: {
              vmid: 100
            }
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const lxc = canonical.$instances_by_id.test_lxc;
      assert.strictEqual(lxc.$aspects.aspect_proxmox.vmid, 100, 'Instance value present');
      assert.strictEqual(lxc.$aspects.aspect_proxmox.host_node, 'pve-01', 'Class default applied');
      assert.strictEqual(lxc.$aspects.aspect_proxmox.start, true, 'Class default applied');
      assert.strictEqual(lxc.$aspects.aspect_proxmox.unprivileged, true, 'Class default applied');
    });

    it('should accumulate $aspect_defaults through inheritance', async () => {
      await createTestFiles({
        'aspects/aspect_compute.class.json': {
          $class: 'aspect_compute',
          $aspect: 'aspect_compute',
          $schema: {
            type: 'object',
            properties: {
              cores: { type: 'number' },
              memory: { type: 'number' },
              storage: { type: 'string' }
            }
          }
        },
        'classes/base_vm.class.json': {
          $class: 'base_vm',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_compute'],
          $aspect_defaults: {
            aspect_compute: {
              cores: 2,
              memory: 1024
            }
          },
          $schema: { type: 'object' }
        },
        'classes/production_vm.class.json': {
          $class: 'production_vm',
          $parent: 'base_vm',
          $aspect_defaults: {
            aspect_compute: {
              cores: 4,
              storage: '50G'
            }
          },
          $schema: { type: 'object' }
        },
        'instances/prod_server.json': {
          $id: 'prod_server',
          $class: 'production_vm',
          $aspects: {
            aspect_compute: {
              memory: 4096
            }
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const server = canonical.$instances_by_id.prod_server;
      assert.strictEqual(server.$aspects.aspect_compute.cores, 4, 'Child class default overrides parent');
      assert.strictEqual(server.$aspects.aspect_compute.memory, 4096, 'Instance value overrides all');
      assert.strictEqual(server.$aspects.aspect_compute.storage, '50G', 'Child class default added');
    });
  });

  describe('Layer 3: Instance Values (Highest Priority)', () => {
    it('should prioritize instance values over all defaults', async () => {
      await createTestFiles({
        'aspects/aspect_network.class.json': {
          $class: 'aspect_network',
          $aspect: 'aspect_network',
          $schema: {
            type: 'object',
            properties: {
              bridge: { type: 'string' },
              gateway: { type: 'string' }
            }
          },
          $defaults: {
            bridge: 'vmbr0',
            gateway: '192.168.1.1'
          }
        },
        'classes/server.class.json': {
          $class: 'server',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_network'],
          $aspect_defaults: {
            aspect_network: {
              bridge: 'vmbr1',
              mtu: 1500
            }
          },
          $schema: { type: 'object' }
        },
        'instances/custom_server.json': {
          $id: 'custom_server',
          $class: 'server',
          $aspects: {
            aspect_network: {
              bridge: 'vmbr2',
              gateway: '10.0.0.1',
              vlan: 100
            }
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const server = canonical.$instances_by_id.custom_server;
      assert.strictEqual(server.$aspects.aspect_network.bridge, 'vmbr2', 'Instance overrides all defaults');
      assert.strictEqual(server.$aspects.aspect_network.gateway, '10.0.0.1', 'Instance overrides aspect default');
      assert.strictEqual(server.$aspects.aspect_network.mtu, 1500, 'Class default applied when not in instance');
      assert.strictEqual(server.$aspects.aspect_network.vlan, 100, 'Instance-only value preserved');
    });
  });

  describe('Complete Three-Layer Merge', () => {
    it('should merge all three layers correctly', async () => {
      await createTestFiles({
        'aspects/aspect_network.class.json': {
          $class: 'aspect_network',
          $aspect: 'aspect_network',
          $schema: {
            type: 'object',
            properties: {
              bridge: { type: 'string' },
              gateway: { type: 'string' },
              nameserver: { type: 'string' },
              mtu: { type: 'number' }
            }
          },
          $defaults: {
            bridge: 'vmbr0',
            gateway: '192.168.1.1',
            nameserver: '8.8.8.8'
          }
        },
        'classes/base_server.class.json': {
          $class: 'base_server',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_network'],
          $aspect_defaults: {
            aspect_network: {
              gateway: '192.168.68.1',
              mtu: 1500
            }
          },
          $schema: { type: 'object' }
        },
        'instances/my_server.json': {
          $id: 'my_server',
          $class: 'base_server',
          $aspects: {
            aspect_network: {
              nameserver: '192.168.68.10',
              ip: '192.168.68.100'
            }
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const server = canonical.$instances_by_id.my_server;
      
      // Layer 1: Aspect defaults
      assert.strictEqual(server.$aspects.aspect_network.bridge, 'vmbr0', 'From aspect definition');
      
      // Layer 2: Class defaults (override layer 1)
      assert.strictEqual(server.$aspects.aspect_network.gateway, '192.168.68.1', 'Class overrides aspect');
      assert.strictEqual(server.$aspects.aspect_network.mtu, 1500, 'From class defaults');
      
      // Layer 3: Instance values (override all)
      assert.strictEqual(server.$aspects.aspect_network.nameserver, '192.168.68.10', 'Instance overrides aspect');
      assert.strictEqual(server.$aspects.aspect_network.ip, '192.168.68.100', 'Instance-only value');
    });

    it('should populate aspects even when not in instance data', async () => {
      await createTestFiles({
        'aspects/aspect_terraform.class.json': {
          $class: 'aspect_terraform',
          $aspect: 'aspect_terraform',
          $schema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' }
            }
          },
          $defaults: {
            enabled: false
          }
        },
        'classes/vm.class.json': {
          $class: 'vm',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_terraform'],
          $schema: { type: 'object' }
        },
        'instances/test_vm.json': {
          $id: 'test_vm',
          $class: 'vm',
          $aspects: {}
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const vm = canonical.$instances_by_id.test_vm;
      assert.ok(vm.$aspects.aspect_terraform, 'Aspect populated even without instance data');
      assert.strictEqual(vm.$aspects.aspect_terraform.enabled, false, 'Aspect default applied');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing aspectLoader gracefully', async () => {
      await createTestFiles({
        'classes/simple.class.json': {
          $class: 'simple',
          $parent: 'entity_base',
          $schema: { type: 'object' }
        },
        'instances/test.json': {
          $id: 'test',
          $class: 'simple',
          $aspects: {
            aspect_custom: { value: 'test' }
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: null
      });

      const test = canonical.$instances_by_id.test;
      assert.strictEqual(test.$aspects.aspect_custom.value, 'test', 'Instance value preserved');
    });

    it('should handle aspect name with aspect_ prefix', async () => {
      await createTestFiles({
        'aspects/aspect_test.class.json': {
          $class: 'aspect_test',
          $aspect: 'aspect_test',
          $schema: {
            type: 'object',
            properties: {
              default_value: { type: 'string' }
            }
          },
          $defaults: {
            default_value: 'from_aspect'
          }
        },
        'classes/test_class.class.json': {
          $class: 'test_class',
          $parent: 'entity_base',
          $uses_aspects: ['aspect_test'],
          $schema: { type: 'object' }
        },
        'instances/test_instance.json': {
          $id: 'test_instance',
          $class: 'test_class',
          $aspects: {
            aspect_test: {}
          }
        }
      });

      await struktur.classLoader.loadClassesFromDirectory(path.join(tempDir, 'classes'));
      const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(path.join(tempDir, 'aspects'));
      for (const aspect of aspects) {
        struktur.validator.registerAspect(aspect);
      }

      const instancesDir = path.join(tempDir, 'instances');
      const files = await fs.readdir(instancesDir);
      const instances = [];
      for (const file of files) {
        const content = await fs.readFile(path.join(instancesDir, file), 'utf-8');
        instances.push(JSON.parse(content));
      }

      const canonical = generateCanonicalWithValidation(instances, struktur, {
        aspectLoader: struktur.aspectLoader
      });

      const instance = canonical.$instances_by_id.test_instance;
      assert.strictEqual(instance.$aspects.aspect_test.default_value, 'from_aspect', 'Aspect default applied despite prefix mismatch');
    });
  });
});
