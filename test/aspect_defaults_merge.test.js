/**
 * Tests for three-layer aspect defaults merge system
 * 
 * Tests the merge hierarchy:
 * 1. Aspect definition defaults (from .aspect.json files)
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
      class: 'entity_base',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    };
    
    const fullPath = path.join(tempDir, 'classes/entity_base.schema.json');
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
        'aspects/aspect_network.aspect.json': {
          aspect: 'aspect_network',
          schema: {
            type: 'object',
            properties: {
              bridge: { type: 'string' },
              gateway: { type: 'string' }
            }
          },
          bridge: 'vmbr0',
          gateway: '192.168.1.1'
        },
        'classes/server.schema.json': {
          class: 'server',
          parent: 'entity_base',
          $uses_aspects: ['network'],
          schema: { type: 'object' }
        },
        'instances/test_server.json': {
          id: 'test_server',
          class: 'server',
          $aspects: {
            network: {
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
      assert.strictEqual(server.$aspects.network.ip, '192.168.1.100', 'Instance value present');
      assert.strictEqual(server.$aspects.network.bridge, 'vmbr0', 'Aspect default applied');
      assert.strictEqual(server.$aspects.network.gateway, '192.168.1.1', 'Aspect default applied');
    });

    it('should handle aspect definitions without defaults', async () => {
      await createTestFiles({
        'aspects/aspect_storage.aspect.json': {
          aspect: 'aspect_storage',
          schema: {
            type: 'object',
            properties: {
              size: { type: 'string' }
            }
          }
        },
        'classes/disk.schema.json': {
          class: 'disk',
          parent: 'entity_base',
          $uses_aspects: ['storage'],
          schema: { type: 'object' }
        },
        'instances/test_disk.json': {
          id: 'test_disk',
          class: 'disk',
          $aspects: {
            storage: {
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
      assert.strictEqual(disk.$aspects.storage.size, '100G', 'Instance value present');
      assert.strictEqual(Object.keys(disk.$aspects.storage).length, 1, 'No extra defaults added');
    });
  });

  describe('Layer 2: Class Hierarchy $aspect_defaults', () => {
    it('should apply defaults from class $aspect_defaults', async () => {
      await createTestFiles({
        'aspects/aspect_proxmox.aspect.json': {
          aspect: 'aspect_proxmox',
          schema: {
            type: 'object',
            properties: {
              host_node: { type: 'string' },
              start: { type: 'boolean' },
              unprivileged: { type: 'boolean' }
            }
          }
        },
        'classes/lxc.schema.json': {
          class: 'lxc',
          parent: 'entity_base',
          $uses_aspects: ['proxmox'],
          $aspect_defaults: {
            proxmox: {
              host_node: 'pve-01',
              start: true,
              unprivileged: true
            }
          },
          schema: { type: 'object' }
        },
        'instances/test_lxc.json': {
          id: 'test_lxc',
          class: 'lxc',
          $aspects: {
            proxmox: {
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
      assert.strictEqual(lxc.$aspects.proxmox.vmid, 100, 'Instance value present');
      assert.strictEqual(lxc.$aspects.proxmox.host_node, 'pve-01', 'Class default applied');
      assert.strictEqual(lxc.$aspects.proxmox.start, true, 'Class default applied');
      assert.strictEqual(lxc.$aspects.proxmox.unprivileged, true, 'Class default applied');
    });

    it('should accumulate $aspect_defaults through inheritance', async () => {
      await createTestFiles({
        'aspects/aspect_compute.aspect.json': {
          aspect: 'aspect_compute',
          schema: {
            type: 'object',
            properties: {
              cores: { type: 'number' },
              memory: { type: 'number' },
              storage: { type: 'string' }
            }
          }
        },
        'classes/base_vm.schema.json': {
          class: 'base_vm',
          parent: 'entity_base',
          $uses_aspects: ['compute'],
          $aspect_defaults: {
            compute: {
              cores: 2,
              memory: 1024
            }
          },
          schema: { type: 'object' }
        },
        'classes/production_vm.schema.json': {
          class: 'production_vm',
          parent: 'base_vm',
          $aspect_defaults: {
            compute: {
              cores: 4,
              storage: '50G'
            }
          },
          schema: { type: 'object' }
        },
        'instances/prod_server.json': {
          id: 'prod_server',
          class: 'production_vm',
          $aspects: {
            compute: {
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
      assert.strictEqual(server.$aspects.compute.cores, 4, 'Child class default overrides parent');
      assert.strictEqual(server.$aspects.compute.memory, 4096, 'Instance value overrides all');
      assert.strictEqual(server.$aspects.compute.storage, '50G', 'Child class default added');
    });
  });

  describe('Layer 3: Instance Values (Highest Priority)', () => {
    it('should prioritize instance values over all defaults', async () => {
      await createTestFiles({
        'aspects/aspect_network.aspect.json': {
          aspect: 'aspect_network',
          schema: {
            type: 'object',
            properties: {
              bridge: { type: 'string' },
              gateway: { type: 'string' }
            }
          },
          bridge: 'vmbr0',
          gateway: '192.168.1.1'
        },
        'classes/server.schema.json': {
          class: 'server',
          parent: 'entity_base',
          $uses_aspects: ['network'],
          $aspect_defaults: {
            network: {
              bridge: 'vmbr1',
              mtu: 1500
            }
          },
          schema: { type: 'object' }
        },
        'instances/custom_server.json': {
          id: 'custom_server',
          class: 'server',
          $aspects: {
            network: {
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
      assert.strictEqual(server.$aspects.network.bridge, 'vmbr2', 'Instance overrides all defaults');
      assert.strictEqual(server.$aspects.network.gateway, '10.0.0.1', 'Instance overrides aspect default');
      assert.strictEqual(server.$aspects.network.mtu, 1500, 'Class default applied when not in instance');
      assert.strictEqual(server.$aspects.network.vlan, 100, 'Instance-only value preserved');
    });
  });

  describe('Complete Three-Layer Merge', () => {
    it('should merge all three layers correctly', async () => {
      await createTestFiles({
        'aspects/aspect_network.aspect.json': {
          aspect: 'aspect_network',
          schema: {
            type: 'object',
            properties: {
              bridge: { type: 'string' },
              gateway: { type: 'string' },
              nameserver: { type: 'string' },
              mtu: { type: 'number' }
            }
          },
          bridge: 'vmbr0',
          gateway: '192.168.1.1',
          nameserver: '8.8.8.8'
        },
        'classes/base_server.schema.json': {
          class: 'base_server',
          parent: 'entity_base',
          $uses_aspects: ['network'],
          $aspect_defaults: {
            network: {
              gateway: '192.168.68.1',
              mtu: 1500
            }
          },
          schema: { type: 'object' }
        },
        'instances/my_server.json': {
          id: 'my_server',
          class: 'base_server',
          $aspects: {
            network: {
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
      assert.strictEqual(server.$aspects.network.bridge, 'vmbr0', 'From aspect definition');
      
      // Layer 2: Class defaults (override layer 1)
      assert.strictEqual(server.$aspects.network.gateway, '192.168.68.1', 'Class overrides aspect');
      assert.strictEqual(server.$aspects.network.mtu, 1500, 'From class defaults');
      
      // Layer 3: Instance values (override all)
      assert.strictEqual(server.$aspects.network.nameserver, '192.168.68.10', 'Instance overrides aspect');
      assert.strictEqual(server.$aspects.network.ip, '192.168.68.100', 'Instance-only value');
    });

    it('should populate aspects even when not in instance data', async () => {
      await createTestFiles({
        'aspects/aspect_terraform.aspect.json': {
          aspect: 'aspect_terraform',
          schema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' }
            }
          },
          enabled: false
        },
        'classes/vm.schema.json': {
          class: 'vm',
          parent: 'entity_base',
          $uses_aspects: ['terraform'],
          schema: { type: 'object' }
        },
        'instances/test_vm.json': {
          id: 'test_vm',
          class: 'vm',
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
      assert.ok(vm.$aspects.terraform, 'Aspect populated even without instance data');
      assert.strictEqual(vm.$aspects.terraform.enabled, false, 'Aspect default applied');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing aspectLoader gracefully', async () => {
      await createTestFiles({
        'classes/simple.schema.json': {
          class: 'simple',
          parent: 'entity_base',
          schema: { type: 'object' }
        },
        'instances/test.json': {
          id: 'test',
          class: 'simple',
          $aspects: {
            custom: { value: 'test' }
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
      assert.strictEqual(test.$aspects.custom.value, 'test', 'Instance value preserved');
    });

    it('should handle aspect name with aspect_ prefix', async () => {
      await createTestFiles({
        'aspects/aspect_test.aspect.json': {
          aspect: 'aspect_test',
          schema: {
            type: 'object',
            properties: {
              default_value: { type: 'string' }
            }
          },
          default_value: 'from_aspect'
        },
        'classes/test_class.schema.json': {
          class: 'test_class',
          parent: 'entity_base',
          $uses_aspects: ['test'],
          schema: { type: 'object' }
        },
        'instances/test_instance.json': {
          id: 'test_instance',
          class: 'test_class',
          $aspects: {
            test: {}
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
      assert.strictEqual(instance.$aspects.test.default_value, 'from_aspect', 'Aspect default applied despite prefix mismatch');
    });
  });
});
