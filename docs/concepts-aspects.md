# Concepts: Aspects

Understanding aspect-based composition for optional, namespaced behavior.

## Overview

**Aspects** provide a way to add optional, composable behaviors to instances without using inheritance. They're perfect for cross-cutting concerns that don't fit neatly into a class hierarchy.

```
Inheritance  → IS-A relationships (post IS-A content)
Aspects      → HAS-A behaviors (server HAS monitoring, HAS backup)
```

---

## What Are Aspects?

Aspects define:
- Optional or required behaviors
- Namespaced data (no field name conflicts)
- Independent validation
- Composable features

**Example:**
```json
// aspects/aspect_monitoring.class.json
{
  "$aspect": "aspect_monitoring",
  "description": "Monitoring configuration",
  "$schema": {
    "type": "object",
    "properties": {
      "metrics_port": { "type": "integer" },
      "health_endpoint": { "type": "string" }
    },
    "required": ["metrics_port"]
  }
}
```

---

## Aspect Structure

### Required Fields

- `$aspect` — Unique aspect identifier
- `$schema` — JSON Schema for aspect data

### Optional Fields

- `description` — What the aspect provides
- `$defaults` — Default values for aspect fields (see [Aspect Defaults](#aspect-defaults))
- Required/optional is declared on classes via `$aspects` (not inside aspect definitions)

---

## Aspect Defaults

### Three-Layer Merge System

Aspect data merges from three sources with clear priority:

```
1. Aspect definition defaults    (base layer)
2. Class $aspect_defaults          (class-specific overrides)
3. Instance $aspects               (highest priority)
```

**Each layer overrides the previous, deep merging objects.**

### Layer 1: Aspect Definition Defaults

Define defaults in the aspect file itself:

```json
// aspects/aspect_proxmox_guest.class.json
{
  "$aspect": "aspect_proxmox_guest",
  "$schema": {
    "type": "object",
    "properties": {
      "host_node": { "type": "string" },
      "start": { "type": "boolean" },
      "unprivileged": { "type": "boolean" }
    }
  },
  "$defaults": {
    "host_node": "default-host",
    "start": true,
    "unprivileged": true
  }
}
```

**Applied to:** All instances using this aspect

### Layer 2: Class $aspect_defaults

Override defaults for a specific $class:

```json
// classes/proxmox_lxc.class.json
{
  "$class": "proxmox_lxc",
  "$parent": "proxmox_guest",
  "$uses_aspects": ["aspect_proxmox_guest"],
  "$aspect_defaults": {
    "aspect_proxmox_guest": {
      "host_node": "polaris",
      "ostemplate": "local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst"
    }
  },
  "$schema": { ... }
}
```

**Applied to:** All instances of `proxmox_lxc` class

**Inheritance:** $aspect_defaults accumulate and deep merge through parent chain (base → child)

### Layer 3: Instance Values

Override for specific instance:

```json
// instances/backbone_web01.json
{
  "$id": "backbone_web01",
  "$class": "proxmox_lxc",
  "$aspects": {
    "aspect_proxmox_guest": {
      "vmid": 400102  // Instance-specific value
      // host_node, ostemplate, start, unprivileged all inherited
    }
  }
}
```

**Final merged result:**
```json
{
  "vmid": 400102,                    // From instance (layer 3)
  "host_node": "polaris",            // From class (layer 2)
  "ostemplate": "local:vztmpl/...",  // From class (layer 2)
  "start": true,                      // From aspect (layer 1)
  "unprivileged": true                // From aspect (layer 1)
}
```

### Benefits of Three-Layer System

**1. DRY Principle** — Define once, inherit everywhere
```json
// ❌ Before: Repeat in every instance
{
  "$aspects": {
    "aspect_proxmox_guest": {
      "host_node": "polaris",
      "ostemplate": "local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst",
      "start": true,
      "unprivileged": true,
      "vmid": 400102
    }
  }
}

// ✅ After: Only declare what's unique
{
  "$aspects": {
    "aspect_proxmox_guest": {
      "vmid": 400102  // Everything else inherited
    }
  }
}
```

**2. Maintainability** — Change defaults in one place
- Update aspect defaults: affects all classes/instances
- Update class $aspect_defaults: affects all instances of that class
- Override in instance: affects only that instance

**3. Clear Priority** — Easy to reason about
- Instance always wins
- Class overrides aspect
- Aspect provides base

---

## Aspect Types

### Automatic Accumulation

**$uses_aspects** lists which aspects a class uses. Since v0.2.9, these accumulate automatically through inheritance:

```json
// infrastructure_entity.class.json
{
  "$class": "infrastructure_entity",
  "$uses_aspects": ["aspect_infrastructure"]
}

// compute_node.class.json (child)
{
  "$class": "compute_node",
  "$parent": "infrastructure_entity",
  "$uses_aspects": ["aspect_compute_node"]  // Only declares its own
}

// proxmox_guest.class.json (grandchild)
{
  "$class": "proxmox_guest",
  "$parent": "compute_node",
  "$uses_aspects": ["aspect_proxmox_guest", "aspect_network_interface"]
}
```

**Accumulated result** for `proxmox_guest`:
```json
["aspect_infrastructure", "aspect_compute_node", "aspect_proxmox_guest", "aspect_network_interface"]
```

**Benefits:**
- Each class declares only its own aspects
- No need to manually list all inherited $uses_aspects
- Changes to parent aspects propagate automatically
- Fully backward compatible (explicit cumulative lists still work)

**Note:** `$uses_aspects` is class metadata only. Instances should use `$aspects` and templates should read `keys $aspects`. Instances do not auto-populate `$uses_aspects`.

---

## Aspect Requirements

### Optional vs Required

Requirement is declared on the **class**, not the aspect definition:

```json
{
  "$class": "server",
  "$aspects": {
    "aspect_monitoring": { "required": false },
    "aspect_security": { "required": true }
  },
  "$schema": { ... }
}
```

**Notes:**
- `required: true` enforces presence on instances of that class
- `required: false` allows omission
- `$aspects` must be an object mapping aspect names to requirement settings

---

## Applying Aspects

### Aspect Data Namespace

Aspects live in the `$aspects` object:

```json
{
  "$id": "web-01",
  "$class": "server",
  "hostname": "web-01.example.com",
  "$aspects": {
    "aspect_monitoring": {
      "metrics_port": 9090,
      "health_endpoint": "/health"
    },
    "aspect_backup": {
      "schedule": "0 2 * * *",
      "retention_days": 30
    }
  }
}
```

**Key point:** Aspect data is namespaced, preventing field name conflicts.

### Multiple Aspects

Instances can have any number of $aspects:

```json
{
  "$id": "db-prod",
  "$class": "database",
  "$aspects": {
    "aspect_monitoring": { ... },
    "aspect_backup": { ... },
    "encryption": { ... },
    "replication": { ... }
  }
}
```

---

## Aspect Validation

### Independent Validation

Each aspect validates independently:

```json
// monitoring aspect schema
{
  "type": "object",
  "properties": {
    "metrics_port": {
      "type": "integer",
      "minimum": 1024,
      "maximum": 65535
    }
  },
  "required": ["metrics_port"]
}
```

**Validation error:**
```
Error: Instance "web-01" aspect "aspect_monitoring"
  Missing required property: metrics_port
```

### Aspect Schema Features

Supports all JSON Schema features:

**Required fields:**
```json
{
  "$schema": {
    "type": "object",
    "required": ["port", "endpoint"]
  }
}
```

**Nested objects:**
```json
{
  "$schema": {
    "type": "object",
    "properties": {
      "database": {
        "type": "object",
        "properties": {
          "host": { "type": "string" },
          "port": { "type": "integer" }
        }
      }
    }
  }
}
```

**Arrays:**
```json
{
  "$schema": {
    "type": "object",
    "properties": {
      "alerts": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

---

## Using Aspects in Templates

### Check Aspect Presence

```handlebars
{{#if $aspects.aspect_monitoring}}
  <div class="aspect_monitoring">
    Port: {{$aspects.aspect_monitoring.metrics_port}}
    Health: {{$aspects.aspect_monitoring.health_endpoint}}
  </div>
{{/if}}
```

### Filter by Aspect

```handlebars
{{!-- Show all $instances with monitoring --}}
<h2>Monitored Services</h2>
{{#each $instances}}
  {{#if $aspects.aspect_monitoring}}
    <li>{{name}} - :{{$aspects.aspect_monitoring.metrics_port}}</li>
  {{/if}}
{{/each}}
```

### Access Aspect Data

```handlebars
{{!-- Direct property access --}}
Backup schedule: {{$aspects.backup.schedule}}
Retention: {{$aspects.backup.retention_days}} days

{{!-- With default --}}
Log level: {{default_value $aspects.logging.level "info"}}
```

---

## When to Use Aspects

### ✅ Use Aspects For:

**1. Optional Features**
- Monitoring configuration
- Backup settings
- Logging options
- SSL/TLS configuration

**2. Cross-Cutting Concerns**
- Security policies
- Compliance requirements
- Cost tracking
- Tagging strategies

**3. Composition Over Inheritance**
```
Bad:  server → monitored_server → backed_up_monitored_server
Good: server + monitoring aspect + backup aspect
```

**4. Feature Flags**
```json
{
  "$aspects": {
    "features": {
      "dark_mode": true,
      "beta_access": false
    }
  }
}
```

### ❌ Don't Use Aspects For:

**1. Core Identity**
```json
// Bad - use class field instead
"$aspects": {
  "type": {
    "role": "database"
  }
}

// Good
"$class": "database"
```

**2. Single-Use Fields**
```json
// Bad - just use regular field
"$aspects": {
  "hostname": {
    "value": "server-01"
  }
}

// Good
"hostname": "server-01"
```

**3. Hierarchical Structure**
```json
// Bad - use domain field
"$aspects": {
  "hierarchy": {
    "$parent": "production"
  }
}

// Good
"domain": "@production"
```

---

## Real-World Examples

### Docked Example (Docker Containers)

**Port Mapping Aspect:**
```json
{
  "$aspect": "aspect_ports",
  "$schema": {
    "type": "object",
    "properties": {
      "mappings": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "container": { "type": "integer" },
            "host": { "type": "integer" }
          }
        }
      }
    }
  }
}
```

**Usage:**
```json
{
  "$id": "nginx",
  "$class": "container",
  "$aspects": {
    "aspect_ports": {
      "mappings": [
        { "container": 80, "host": 8080 },
        { "container": 443, "host": 8443 }
      ]
    }
  }
}
```

**Template:**
```handlebars
services:
  {{$id}}:
    image: {{image}}
    {{#if $aspects.ports}}
    ports:
      {{#each $aspects.ports.mappings}}
      - "{{host}}:{{container}}"
      {{/each}}
    {{/if}}
```

### Infrastructure Monitoring

**Monitoring Aspect:**
```json
{
  "$aspect": "aspect_monitoring",
  "$schema": {
    "type": "object",
    "properties": {
      "prometheus": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean" },
          "port": { "type": "integer" },
          "path": { "type": "string" }
        }
      },
      "alerts": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

**Multiple Instances:**
```json
// web-01.json
{
  "$id": "web-01",
  "$class": "server",
  "$aspects": {
    "aspect_monitoring": {
      "prometheus": {
        "enabled": true,
        "port": 9090,
        "path": "/metrics"
      },
      "alerts": ["high_cpu", "high_memory"]
    }
  }
}

// db-01.json (different monitoring config)
{
  "$id": "db-01",
  "$class": "database",
  "$aspects": {
    "aspect_monitoring": {
      "prometheus": {
        "enabled": true,
        "port": 9187,
        "path": "/metrics"
      },
      "alerts": ["high_connections", "replication_lag"]
    }
  }
}
```

---

## Aspect Composition Patterns

### Pattern 1: Feature Bundles

Group related $aspects:

```json
// Production instance
{
  "$id": "api-prod",
  "$class": "service",
  "$aspects": {
    "aspect_monitoring": { ... },
    "aspect_backup": { ... },
    "security": { ... },
    "compliance": { ... }
  }
}

// Development instance (fewer aspects)
{
  "$id": "api-dev",
  "$class": "service",
  "$aspects": {
    "aspect_monitoring": { ... }
  }
}
```

### Pattern 2: Conditional Rendering

```handlebars
{{!-- Only configure backup if aspect present --}}
{{#if $aspects.backup}}
  backup:
    enabled: true
    schedule: {{$aspects.backup.schedule}}
    retention: {{$aspects.backup.retention_days}}
{{else}}
  backup:
    enabled: false
{{/if}}
```

### Pattern 3: Aspect-Driven Configuration

```handlebars
{{!-- Generate monitoring config for all monitored $instances --}}
scrape_configs:
{{#each $instances}}
  {{#if $aspects.aspect_monitoring}}
  - job_name: {{$id}}
    static_configs:
      - targets: ['{{hostname}}:{{$aspects.aspect_monitoring.metrics_port}}']
    metrics_path: {{default_value $aspects.aspect_monitoring.path "/metrics"}}
  {{/if}}
{{/each}}
```

---

## Best Practices

### Aspect Design

**1. Single Responsibility**
- One aspect = one concern
- Don't create "kitchen sink" aspects

**2. Clear Naming**
- Name describes the behavior: `monitoring`, `backup`, `logging`
- Avoid generic names: `config`, `settings`, `options`

**3. Sensible Defaults**
```json
{
  "$aspect": "aspect_logging",
  "$defaults": {
    "level": "info",
    "format": "json"
  }
}
```

### Schema Design

**1. Required vs Optional Fields**
```json
{
  "$schema": {
    "required": ["port"],  // Must have
    "properties": {
      "port": { "type": "integer" },
      "path": { "type": "string" }  // Optional
    }
  }
}
```

**2. Validation Constraints**
```json
{
  "$schema": {
    "properties": {
      "port": {
        "type": "integer",
        "minimum": 1024,
        "maximum": 65535
      },
      "level": {
        "type": "string",
        "enum": ["debug", "info", "warn", "error"]
      }
    }
  }
}
```

### Instance Usage

**1. Document Aspects**
```json
{
  "$id": "web-01",
  "$class": "server",
  "name": "Web Server 01",
  "description": "Production web server with monitoring and backup",
  "$aspects": {
    "aspect_monitoring": { ... },
    "aspect_backup": { ... }
  }
}
```

**2. Consistent Application**
- Apply same aspects to similar instances
- Document why aspects differ
- Use aspect presence for filtering

---

## Aspects vs Inheritance

### When to Use Each

**Inheritance (IS-A):**
```
blog_post IS-A content
web_server IS-A server
```

**Aspects (HAS-A):**
```
server HAS monitoring
server HAS backup
```

### Comparison Table

| Feature | Inheritance | Aspects |
|---------|-------------|---------|
| Relationship | IS-A | HAS-A |
| Mandatory | Yes (can't remove parent) | Optional |
| Namespace | Shared fields | Separate namespace |
| Conflicts | Child overrides parent | No conflicts |
| Validation | Per-class schemas | Per-aspect schema |
| Composition | Single/multiple parents | Unlimited aspects |

### Combined Usage

Use both for maximum flexibility:

```json
{
  "$id": "web-prod-01",
  "$class": "web_server",      // Inheritance
  "$parent": "server",          // IS-A server
  "$aspects": {                 // Composition
    "aspect_monitoring": { ... },     // HAS monitoring
    "aspect_backup": { ... },         // HAS backup
    "ssl": { ... }             // HAS SSL
  }
}
```

---

## Common Errors

### Missing Required Aspect

```
Error: Instance "server-01" missing required aspect "security"
Applies to $class: server
```

**Fix:** Add the aspect:
```json
{
  "$aspects": {
    "security": {
      "firewall": true
    }
  }
}
```

### Aspect Validation Failure

```
Error: Instance "web-01" aspect "aspect_monitoring"
  Property "metrics_port" is required
```

**Fix:** Add required field:
```json
{
  "$aspects": {
    "aspect_monitoring": {
      "metrics_port": 9090
    }
  }
}
```

### Unknown Aspect

```
Warning: Instance "app" uses undefined aspect "custom"
```

**Fix:** Define the aspect or remove from instance.

---

## See Also

- [Concepts: Classes & Schemas](concepts-classes-schemas.md) - Inheritance patterns
- [Tutorial: Extending Universal](tutorial-extending-universal.md) - Aspects in action
- [Helper Reference](helpers-reference.md) - Template aspect helpers
- [Errors & Troubleshooting](errors-troubleshooting.md) - Common issues
