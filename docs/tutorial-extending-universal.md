# Tutorial: Extending Universal

Learn how to build on Universal's foundation using **aspects** (the correct pattern for adding custom data). This 20-minute tutorial shows the aspect-based composition pattern used throughout Struktur.

## What You'll Learn

- Use Universal's entity_base class
- Extend functionality with aspects
- Organize with domain hierarchies  
- Multi-stack composition with explicit paths
- Template access to aspect data

## Prerequisites

- Completed [First Stack Tutorial](tutorial-first-stack.md) or equivalent experience
- Struktur installed

---

## Why Universal?

**Universal** provides foundational classes for most infrastructure stacks:

- **universal_base** - Root with $id, $class, name, description
- **entity_base** - Extends universal_base with domains, aspects, relations
- **aspect_base** - For defining aspect schemas
- **domain_root** - For hierarchical organization

**Key Design:**
- Universal uses `additionalProperties: false` for strict validation
- Custom data goes in **aspects** (namespaced, validated)
- Don't create custom classes - use entity_base + aspects
- Domains provide hierarchical organization

---

## Step 1: Initialize Universal

```bash
struktur init universal
cd universal
struktur info -c classes/
```

**Output:**
```
=== Classes ===
  domain_root (inherits: universal_base)
  entity_base (inherits: universal_base)
  global (inherits: none)
  universal_base (inherits: none)

Total: 4 classes
```

✅ **Checkpoint:** Universal stack initialized with 4 base classes.

---

## Step 2: Create Extension Stack

Create a new stack directory for your custom infrastructure.

```bash
cd ..
mkdir infra-stack && cd infra-stack
mkdir classes instances templates aspects
```

**Directory structure:**
```
infra-stack/
├── aspects/     # Aspect definitions (custom schemas)
├── instances/   # Your data
└── templates/   # Your templates
```

---

## Step 3: Create Server Aspect

Aspects are the **correct way** to add custom fields to universal entities.

**\`aspects/server.json\`:**
```json
{
  "$id": "server",
  "$class": "aspect_base",
  "name": "Server Configuration",
  "description": "Server hardware and OS configuration",
  "$schema": {
    "\$schema": "http://json-schema.org/draft-07/schema#",
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

**Why aspects?**
- Namespaced (no conflicts with universal fields)
- Validated (aspect schema enforces rules)
- Optional (entities can mix different aspects)
- Composable (entities can have multiple aspects)

---

## Step 4: Create Domain Structure

Domains provide hierarchical organization.

**\`instances/production-domain.json\`:**
```json
{
  "$id": "production",
  "$class": "domain_root",
  "name": "Production Environment",
  "description": "Production infrastructure"
}
```

**\`instances/web-tier-domain.json\`:**
```json
{
  "$id": "web-tier",
  "$class": "domain_root",
  "name": "Web Tier",
  "description": "Load balancers and web servers",
  "domains": ["production"]
}
```

**Key concept:** \`"domains": ["production"]\` creates a parent-child relationship. Domain instances can be nested arbitrarily deep.

---

## Step 5: Create Server Instances

Use **entity_base** class with the **server aspect**.

**\`instances/web-01.json\`:**
```json
{
  "$id": "web-01",
  "$class": "entity_base",
  "name": "Web Server 01",
  "description": "Primary web server",
  "domains": ["web-tier"],
  "$aspects": {
    "aspect_server": {
      "hostname": "web-01",
      "ip_address": "10.0.1.10",
      "os": "linux",
      "cpu_cores": 4,
      "memory_gb": 16
    }
  }
}
```

**\`instances/web-02.json\`:**
```json
{
  "$id": "web-02",
  "$class": "entity_base",
  "name": "Web Server 02",
  "description": "Secondary web server",
  "domains": ["web-tier"],
  "$aspects": {
    "aspect_server": {
      "hostname": "web-02",
      "ip_address": "10.0.1.11",
      "os": "linux",
      "cpu_cores": 4,
      "memory_gb": 16
    }
  }
}
```

**What you get:**
- From **entity_base**: $id, name, description, domains, aspects
- From **server aspect**: hostname, ip_address, os, cpu_cores, memory_gb
- Validated against both universal and aspect schemas

---

## Step 6: Validate Multi-Stack

Use explicit path flags to load both universal and your stack.

```bash
struktur validate -c ../universal/classes classes/ -a ../universal/aspects aspects/ -i ../universal/instances instances/
```

**Output:**
```
=== Validation Results ===

✓ global (global)
✓ production (domain_root)
✓ web-01 (entity_base)
✓ web-02 (entity_base)
✓ web-tier (domain_root)

=== Summary ===
Total:    5
Valid:    5
Invalid:  0
Errors:   0
```

✅ **Checkpoint:** All instances validate with aspect data.

**Key pattern:** Multiple \`-c\`, \`-a\`, \`-i\` paths are merged left-to-right (universal first, then local).

---

## Step 7: Override Global Configuration

Universal includes a global instance with viewer.html template. Override it for your needs.

**\`instances/global.json\`:**
```json
{
  "$id": "global",
  "$class": "global",
  "description": "Infrastructure configuration",
  "$render": [
    {
      "template": "inventory.txt",
      "output": "/inventory.txt"
    }
  ]
}
```

**What happens:** Instance merging combines both global.json files, with your version taking precedence for conflicting fields. The \`build\` array is replaced entirely.

---

## Step 8: Create Template Using Aspects

**\`templates/inventory.txt\`:**
```handlebars
# Infrastructure Inventory

## Domains
{{#each (where $instances "$class" "domain_root")}}
- {{name}}: {{description}}
  {{#if (gt (length domains) 0)}}Parent Domains: {{#each domains}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
{{/each}}

## Servers
{{#each $instances}}
{{#if $aspects.aspect_server}}
### {{name}}
- Hostname: {{$aspects.aspect_server.hostname}}
- IP: {{$aspects.aspect_server.ip_address}}
- OS: {{$aspects.aspect_server.os}}
- Resources: {{$aspects.aspect_server.cpu_cores}} cores, {{$aspects.aspect_server.memory_gb}}GB RAM
- Domains: {{#each domains}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

{{/if}}
{{/each}}
```

**Aspect access:**
- Check presence: \`{{#if $aspects.aspect_server}}\`
- Access data: \`{{$aspects.aspect_server.hostname}}\`
- Filter: iterate all instances, check for aspect

---

## Step 9: Build Multi-Stack

```bash
struktur build -c ../universal/classes classes/ -a ../universal/aspects aspects/ -i ../universal/instances instances/ -t ../universal/templates templates/
```

**Output:**
```
📦 Loading stack...
  ✓ Loaded 4 classes
  ✓ Loaded 0 aspects
  ✓ Loaded 6 instances
  ✓ Merged 1 duplicate IDs into 5 unique instances

🔍 Validating stack...
  ✓ All 5 class-bearing instances valid

📁 Preparing build directory: ./build/build-<hash>/

📝 Writing outputs...
  ✓ canonical.json (5 instances)
  ✓ meta/classes/ (4 classes)
  ✓ meta/validation.json

🎨 Rendering templates...
  Found 2 build tasks
  ✓ 2 files rendered

✨ Build complete!
  📊 5 instances validated
  📦 4 class definitions
  🎨 2 templates rendered
  📂 ./build/build-<hash>/

✨ Open ./build/build-<hash>/index.html to view your stack
```

---

## Step 10: View Results

```bash
cat build/build-*/inventory.txt
```

**Output:**
```
# Infrastructure Inventory

## Domains
- Production Environment: Production infrastructure
  
- Web Tier: Load balancers and web servers
  Parent Domains: production

## Servers
### Web Server 01
- Hostname: web-01
- IP: 10.0.1.10
- OS: linux
- Resources: 4 cores, 16GB RAM
- Domains: web-tier

### Web Server 02
- Hostname: web-02
- IP: 10.0.1.11
- OS: linux
- Resources: 4 cores, 16GB RAM
- Domains: web-tier
```

✅ **Success!** Aspect-based extension with domain hierarchy.

---

## What You Learned

### Aspect Pattern (Recommended)
- **Don't create custom classes** - use entity_base
- **Do use aspects** for custom data (namespaced, validated)
- Universal's strict schema ensures consistency
- Aspects enable composition over inheritance

### Multi-Stack Composition
- Use explicit \`-c\`, \`-a\`, \`-i\`, \`-t\` flags
- Paths merge left-to-right (base first, extensions after)
- Instance merging handles duplicate IDs
- Templates search all template directories

### Domain Hierarchies
- \`domain_root\` class for organization
- \`domains\` array creates parent-child links
- Viewer template visualizes hierarchy
- Domains are reference strings (not objects)

---

## Alternative: Custom Class Pattern

If you **really need** custom top-level fields (not recommended):

```json
{
  "$class": "server",
  "$parent": "entity_base",
  "$schema": {
    "\$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "$id": {"type": "string"},
      "$class": {"type": "string"},
      "name": {"type": "string"},
      "description": {"type": "string"},
      "domains": {"type": "array", "items": {"type": "string"}},
      "hostname": {"type": "string"},
      "ip_address": {"type": "string"}
    },
    "required": ["$id", "$class", "hostname"],
    "additionalProperties": true
  }
}
```

**Downsides:**
- Must list ALL properties (inherited + custom)
- Schema inheritance doesn't auto-merge
- Loses universal's strict validation benefits
- More verbose, harder to maintain

**Use aspects instead!**

---

## Next Steps

### Add More Aspects

```json
{
  "$aspect": "aspect_monitoring",
  "$schema": {
    "type": "object",
    "properties": {
      "metrics_port": {"type": "integer"},
      "health_endpoint": {"type": "string"}
    }
  }
}
```

Apply to instances:
```json
{
  "$id": "web-01",
  "$class": "entity_base",
  "$aspects": {
    "aspect_server": {...},
    "aspect_monitoring": {
      "metrics_port": 9090,
      "health_endpoint": "/health"
    }
  }
}
```

### Use Viewer Template

Universal includes an interactive hierarchical viewer:

```json
{
  "$id": "global",
  "$class": "global",
  "$render": [
    {
      "template": "viewer.html",
      "output": "/index.html"
    }
  ]
}
```

Open \`build/build-*/index.html\` to see your domain hierarchy visualized.

### Explore Examples

- **docked** - Docker containers with aspects
- **skribe** - Static site without universal
- Check \`examples/\` in Struktur installation

---

## Common Patterns

### Conditional Aspects

```handlebars
{{#if $aspects.aspect_monitoring}}
Monitoring: {{$aspects.aspect_monitoring.metrics_port}}
{{/if}}
```

### Filter by Aspect

```handlebars
{{#each $instances}}
  {{#if $aspects.aspect_server}}
    {{!-- Has server aspect --}}
  {{/if}}
{{/each}}
```

### Multiple Aspects

```json
{
  "$aspects": {
    "aspect_server": {...},
    "aspect_monitoring": {...},
    "aspect_backup": {...}
  }
}
```

### Aspect Names (From $aspects)

```handlebars
Aspects: {{#each (keys $aspects)}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
```

---

## Troubleshooting

### "Unexpected field" errors

**Problem:** Added custom fields directly to entity_base instance.

**Solution:** Use aspects instead:
```json
{
  "$class": "entity_base",
  "$aspects": {
    "your_aspect": {
      "custom_field": "value"
    }
  }
}
```

### "Class not found" errors

**Problem:** Forgot to include universal classes path.

**Solution:** Always use \`-c ../universal/classes classes/\` for multi-stack.

### Template can't find data

**Problem:** Accessing aspect data incorrectly.

**Solution:** Use \`$aspects.aspect_name.field\`:
```handlebars
{{$aspects.aspect_server.hostname}}
```

---

## Learn More

- **[First Stack Tutorial](tutorial-first-stack.md)** - Build blog from scratch
- **[CLI Reference](cli-reference.md)** - All commands and flags
- **[Concepts: Aspects](concepts-aspects.md)** - Deep dive into aspect system
- **[Docked Example](../examples/docked/)** - Real-world aspect usage

---

Ready to build infrastructure stacks? The aspect pattern unlocks Universal's full power!
