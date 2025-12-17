# Tutorial: Extending Universal

Learn how to build on Universal's foundation using inheritance, aspects, and domain organization. This 25-minute tutorial shows real-world patterns from the Docked example.

## What You'll Learn

- Inherit from Universal's base classes
- Use aspects for composition
- Organize with domain hierarchies
- Reference instances with tags
- Multi-stack composition

## Prerequisites

- Completed [First Stack Tutorial](tutorial-first-stack.md) or equivalent experience
- Struktur installed
- Universal initialized

---

## Why Universal?

**Universal** provides foundational classes that most stacks need:

- **entity_base** - Root class with id, name, description, labels, domain
- **aspect_base** - For aspect definitions
- **domain_root** - For hierarchical organization

**Benefits:**
- Don't reinvent common fields
- Consistent structure across stacks
- Shared tooling (viewer template)
- Gradual adoption (use what you need)

---

## Step 1: Initialize Universal

```bash
struktur init universal
cd universal
struktur info -c classes/
```

**You'll see:**
```
=== Classes ===
  domain_root (inherits: universal_base)
  entity_base (inherits: universal_base)
  global (inherits: none)
  universal_base (inherits: none)

Total: 4 classes
```

---

## Step 2: Create Extension Stack

Create a new stack that extends Universal.

```bash
cd ..
mkdir infra-stack && cd infra-stack
mkdir classes instances templates aspects
```

---

## Step 3: Configure Multi-Stack Build

**`struktur.build.json`:**
```json
{
  "classes": ["../universal/classes", "./classes"],
  "aspects": ["../universal/aspects", "./aspects"],
  "instances": ["../universal/instances", "./instances"],
  "templates": ["../universal/templates", "./templates"],
  "buildDir": "./build"
}
```

**Key concept:** Arrays are merged left-to-right. Universal provides base, your stack adds specialization.

---

## Step 4: Create Class Inheriting from entity_base

**`classes/server.schema.json`:**
```json
{
  "class": "server",
  "parent": "entity_base",
  "hostname": "localhost",
  "ip_address": "",
  "os": "linux",
  "cpu_cores": 2,
  "memory_gb": 4,
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "hostname": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      },
      "ip_address": {
        "type": "string",
        "format": "ipv4"
      },
      "os": {
        "type": "string",
        "enum": ["linux", "windows", "macos"]
      },
      "cpu_cores": {
        "type": "integer",
        "minimum": 1,
        "maximum": 128
      },
      "memory_gb": {
        "type": "integer",
        "minimum": 1,
        "maximum": 1024
      }
    },
    "required": ["hostname", "ip_address", "os"]
  }
}
```

**What you get:**
- From `entity_base`: id, name, description, labels, domain
- From `server`: hostname, ip_address, os, cpu_cores, memory_gb
- `schema`: Validation rules (constraints, required fields)

---

## Step 5: Verify Inheritance

```bash
struktur info -c ../universal/classes classes/
```

**Output:**
```
Classes loaded: 4

entity_base
  parent: (none)

aspect_base
  parent: entity_base

domain_root
  parent: entity_base

server
  parent: entity_base
  schema: server.schema.json
```

✅ **Checkpoint:** server inherits from entity_base.

---

## Step 7: Create Domain Structure

Domains provide hierarchical organization.

**`instances/production-domain.json`:**
```json
{
  "id": "production",
  "class": "domain_root",
  "name": "Production Environment",
  "description": "Production infrastructure"
}
```

**`instances/web-tier-domain.json`:**
```json
{
  "id": "web-tier",
  "class": "domain_root",
  "name": "Web Tier",
  "description": "Load balancers and web servers",
  "domain": "@production"
}
```

**Key concept:** `"domain": "@production"` is a **tag reference** that creates parent-child relationship.

---

## Step 8: Create Server Instances

**`instances/web-01.json`:**
```json
{
  "id": "web-01",
  "class": "server",
  "name": "Web Server 01",
  "description": "Primary web server",
  "domain": "@web-tier",
  "hostname": "web-01",
  "ip_address": "10.0.1.10",
  "os": "linux",
  "cpu_cores": 4,
  "memory_gb": 16,
  "labels": ["nginx", "production"]
}
```

**`instances/web-02.json`:**
```json
{
  "id": "web-02",
  "class": "server",
  "name": "Web Server 02",
  "description": "Secondary web server",
  "domain": "@web-tier",
  "hostname": "web-02",
  "ip_address": "10.0.1.11",
  "os": "linux",
  "cpu_cores": 4,
  "memory_gb": 16,
  "labels": ["nginx", "production", "standby"]
}
```

---

## Step 9: Validate

```bash
struktur validate .
```

**Expected output:**
```
✓ Loaded 4 classes (3 from universal, 1 local)
✓ Loaded 4 instances
✓ Validation passed
  - production (domain_root)
  - web-tier (domain_root)
  - web-01 (server)
  - web-02 (server)
```

✅ **Checkpoint:** All instances valid with inherited fields.

---

## Step 10: Use Aspect Composition

Aspects provide reusable behaviors without inheritance.

**`aspects/monitoring.json`:**
```json
{
  "id": "monitoring",
  "class": "aspect_base",
  "name": "Monitoring",
  "description": "Monitoring configuration",
  "kind": "required",
  "schema": {
    "type": "object",
    "properties": {
      "metrics_port": {
        "type": "integer"
      },
      "health_endpoint": {
        "type": "string"
      }
    },
    "required": ["metrics_port"]
  }
}
```

**Key concept:** Aspects define **optional or required** namespaced data.

---

## Step 11: Apply Aspect to Instance

**`instances/web-01.json`** (updated):
```json
{
  "id": "web-01",
  "class": "server",
  "name": "Web Server 01",
  "description": "Primary web server",
  "domain": "@web-tier",
  "hostname": "web-01",
  "ip_address": "10.0.1.10",
  "os": "linux",
  "cpu_cores": 4,
  "memory_gb": 16,
  "labels": ["nginx", "production"],
  "aspects": {
    "monitoring": {
      "metrics_port": 9090,
      "health_endpoint": "/health"
    }
  }
}
```

**What happens:**
- Struktur validates `aspects.monitoring` against aspect schema
- Data is namespaced to avoid conflicts
- Templates can check for aspect presence

---

## Step 12: Create Template Using Inheritance

**`templates/inventory.txt.hbs`:**
```handlebars
# Infrastructure Inventory
Generated: {{buildContext.timestamp}}

## Domains
{{#each (where instances "class" "domain_root")}}
- {{name}}: {{description}}
  ID: {{id}}
  {{#if domain}}Parent: {{domain}}{{/if}}
{{/each}}

## Servers
{{#each (where instances "class" "server")}}
### {{name}}
- Hostname: {{hostname}}
- IP: {{ip_address}}
- OS: {{os}}
- Resources: {{cpu_cores}} cores, {{memory_gb}}GB RAM
- Domain: {{domain}}
- Labels: {{join labels ", "}}
{{#if aspects.monitoring}}
- Monitoring: Port {{aspects.monitoring.metrics_port}}, Health {{aspects.monitoring.health_endpoint}}
{{/if}}

{{/each}}
```

**Helpers used:**
- `where` - Filter by class
- `join` - Format arrays
- `#if aspects.monitoring` - Check aspect presence

---

## Step 13: Create Template with Inheritance Filtering

**`templates/production-servers.html.hbs`:**
```handlebars
<!DOCTYPE html>
<html>
<head>
  <title>Production Servers</title>
  <style>
    body { font-family: monospace; }
    .server { margin: 1rem; padding: 1rem; border: 1px solid #ccc; }
    .label { background: #e3f2fd; padding: 0.25rem; margin: 0.25rem; display: inline-block; }
  </style>
</head>
<body>
  <h1>Production Servers</h1>
  
  {{#each (filter_inherits instances "entity_base" classes_by_id)}}
    {{#if (eq class "server")}}
      <div class="server">
        <h2>{{name}}</h2>
        <p><strong>ID:</strong> {{id}}</p>
        <p><strong>Hostname:</strong> {{hostname}}</p>
        <p><strong>IP:</strong> {{ip_address}}</p>
        <p><strong>Domain:</strong> {{domain}}</p>
        
        {{#if labels}}
          <div>
            <strong>Labels:</strong>
            {{#each labels}}
              <span class="label">{{this}}</span>
            {{/each}}
          </div>
        {{/if}}
        
        {{#if aspects.monitoring}}
          <p><strong>Monitoring:</strong> :{{aspects.monitoring.metrics_port}} {{aspects.monitoring.health_endpoint}}</p>
        {{/if}}
      </div>
    {{/if}}
  {{/each}}
  
  <footer>
    <p>Total servers: {{length (where instances "class" "server")}}</p>
  </footer>
</body>
</html>
```

**Key helper:**
- `filter_inherits` - Get all instances inheriting from entity_base

---

## Step 14: Build

```bash
struktur build .
```

**Expected output:**
```
Build Phase: Stack Loading & Validation
✓ Loaded 4 classes (3 from universal, 1 local)
✓ Loaded 1 aspect
✓ Loaded 4 instances
✓ Validation passed

Build Phase: Template Loading
✓ Loaded 3 templates (1 from universal, 2 local)

Build Phase: Rendering
✓ Rendered viewer.html (from universal)
✓ Rendered inventory.txt
✓ Rendered production-servers.html

Build complete: build/build-abc123/
```

---

## Step 15: Inspect Outputs

```bash
ls build/build-*/
# canonical.json
# viewer.html       (Universal's hierarchical viewer)
# inventory.txt     (Your text inventory)
# production-servers.html

cat build/build-*/inventory.txt
open build/build-*/viewer.html
open build/build-*/production-servers.html
```

✅ **Success!** You've extended Universal with domain-specific classes.

---

## Advanced: Tag References

Tags create relationships between instances.

### One-to-One Reference

```json
{
  "id": "app-server",
  "class": "server",
  "name": "Application Server",
  "load_balancer": "@lb-01"
}
```

### One-to-Many Reference

```json
{
  "id": "web-cluster",
  "class": "cluster",
  "name": "Web Cluster",
  "servers": ["@web-01", "@web-02", "@web-03"]
}
```

### Use in Templates

```handlebars
{{#each servers}}
  <!-- Each server is a tag reference -->
  Server: {{this}}
{{/each}}
```

**Future:** `resolve` helper will dereference tags to full instances.

---

## Real-World Example: Docked

The **Docked** example shows production-grade Universal extension:

```bash
cd ..
struktur init --example docked
cd docked
cat README.md
```

**What Docked adds:**
- **Classes**: container, network, volume, compose_service
- **Aspects**: ports, environment, volumes, networks, healthcheck
- **Domains**: Services organized hierarchically
- **Templates**: Generates docker-compose.yml, .env, HTML catalog
- **Validation**: Port ranges, volume types, network configs

**Key patterns:**
- Containers inherit from entity_base (get id, name, description, domain)
- Aspects provide optional configuration (ports, env vars)
- Templates query by inheritance: `filter_inherits instances "container"`
- Multi-output: One canonical model → many rendered files

---

## What You Learned

### Universal Extension
- Inherit from entity_base for common fields
- Add domain-specific classes
- Reuse Universal's viewer template

### Multi-Stack Composition
- `struktur.build.json` merges multiple directories
- Earlier stacks provide base, later override
- Classes, instances, templates all merge

### Aspects
- Define reusable behaviors
- Namespaced to avoid conflicts
- Validated independently
- Optional or required per aspect `kind`

### Tag References
- `@instance-id` creates relationships
- Domain hierarchies via `domain: "@parent"`
- Future: `resolve` helper for dereferencing

### Inheritance Helpers
- `filter_inherits` - Find all instances of base class
- `inherits` - Check class lineage
- `class_lineage` - Full parent chain

---

## Best Practices

### When to Extend Universal

✅ **Use Universal when:**
- You need id, name, description, domain, labels
- You want hierarchical organization
- You're building infrastructure/config management
- You want a standard base for multiple stacks

❌ **Skip Universal when:**
- Fields don't match your domain
- You prefer different naming conventions
- You're building something completely different
- Universal adds unnecessary complexity

### Class Design

**Do:**
- Inherit from entity_base for entities
- Use aspects for optional, composable features
- Keep class defaults sensible
- Document required fields in schemas

**Don't:**
- Create deep inheritance chains (3-4 levels max)
- Mix inheritance and aspects for same concern
- Override parent fields unnecessarily

### Domain Organization

**Hierarchical domains:**
```
production/
  ├── web-tier/
  │   ├── web-01
  │   └── web-02
  └── db-tier/
      └── db-01
```

**Flat domains:**
```
domains/
  ├── web-servers
  ├── databases
  └── monitoring
```

Choose what fits your model.

---

## Next Steps

### Explore Real Examples

```bash
# Docker container stack (aspect-heavy)
struktur init --example docked
cd docked && struktur build .

# Static site (class-heavy)
struktur init --example skribe
cd skribe && struktur build .
```

### Deep Dives

- **[Concepts: Aspects](concepts-aspects.md)** - Composition patterns
- **[Concepts: Validation](concepts-validation.md)** - Multi-pass validation
- **[Concepts: Classes & Schemas](concepts-classes-schemas.md)** - Class design
- **[Guide: Stack Patterns](guide-stack-patterns.md)** - Reusable patterns

### Build Your Own

**Ideas:**
- Kubernetes manifests (extend Universal for pods, services, deployments)
- Terraform modules (resources as entity_base instances)
- CI/CD pipelines (jobs, stages, environments)
- API documentation (endpoints as entities)
- Team org charts (people, teams, domains)

---

## Troubleshooting

### Class not found

```
Error: Instance "my-server" references unknown class "server"
```

**Solution:** Ensure you're building with Universal:
```bash
struktur build -c ../universal/classes classes/
```

### Validation fails on inherited fields

```
Error: Property "name" is required but not provided
```

**Cause:** entity_base.schema.json requires `name`.

**Solution:** Add to instance:
```json
{
  "id": "my-server",
  "class": "server",
  "name": "My Server",  // Required by entity_base
  ...
}
```

### Aspect validation errors

```
Error: aspects.monitoring missing required property "metrics_port"
```

**Solution:** 
1. Add missing field: `"metrics_port": 9090`
2. Or make aspect optional: `"kind": "optional"` in aspect definition

### Template can't find Universal helper

**Issue:** Universal viewer uses specific context structure.

**Solution:** Copy viewer.html.hbs to your templates/ and modify, or use simple templates like examples above.

---

## Summary

You learned how to:
- ✅ Extend Universal base classes
- ✅ Configure multi-stack builds
- ✅ Use domain hierarchies
- ✅ Apply aspects for composition
- ✅ Use tag references
- ✅ Filter by inheritance in templates
- ✅ Generate multiple outputs

**Core insight:** Universal provides a foundation, but you control what you build on top. Use what fits, skip what doesn't.

Ready to master the concepts? Explore the [Concepts documentation](INDEX.md#core-concepts) for deep dives into each topic.
