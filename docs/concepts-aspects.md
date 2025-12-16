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
// aspects/monitoring.json
{
  "id": "monitoring",
  "class": "aspect_base",
  "name": "Monitoring Configuration",
  "kind": "optional",
  "schema": {
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

- `id` — Unique aspect identifier
- `class` — Must be `"aspect_base"` or subclass
- `kind` — `"required"` or `"optional"`
- `schema` — JSON Schema for aspect data

### Optional Fields

- `name` — Human-readable name
- `description` — What the aspect provides
- `defaults` — Default values for aspect fields

---

## Aspect Kinds

### Optional Aspects

Instances can use or omit:

```json
{
  "id": "monitoring",
  "class": "aspect_base",
  "kind": "optional",
  "schema": { ... }
}
```

**Usage:**
```json
// Instance without aspect (valid)
{
  "id": "server-01",
  "class": "server"
}

// Instance with aspect (also valid)
{
  "id": "server-02",
  "class": "server",
  "aspects": {
    "monitoring": {
      "metrics_port": 9090
    }
  }
}
```

### Required Aspects

All instances of certain classes must include:

```json
{
  "id": "security",
  "class": "aspect_base",
  "kind": "required",
  "applies_to": ["server", "database"],
  "schema": { ... }
}
```

**Validation enforces presence for applicable classes.**

---

## Applying Aspects

### Aspect Data Namespace

Aspects live in the `aspects` object:

```json
{
  "id": "web-01",
  "class": "server",
  "hostname": "web-01.example.com",
  "aspects": {
    "monitoring": {
      "metrics_port": 9090,
      "health_endpoint": "/health"
    },
    "backup": {
      "schedule": "0 2 * * *",
      "retention_days": 30
    }
  }
}
```

**Key point:** Aspect data is namespaced, preventing field name conflicts.

### Multiple Aspects

Instances can have any number of aspects:

```json
{
  "id": "db-prod",
  "class": "database",
  "aspects": {
    "monitoring": { ... },
    "backup": { ... },
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
Error: Instance "web-01" aspect "monitoring"
  Missing required property: metrics_port
```

### Aspect Schema Features

Supports all JSON Schema features:

**Required fields:**
```json
{
  "schema": {
    "type": "object",
    "required": ["port", "endpoint"]
  }
}
```

**Nested objects:**
```json
{
  "schema": {
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
  "schema": {
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
{{#if aspects.monitoring}}
  <div class="monitoring">
    Port: {{aspects.monitoring.metrics_port}}
    Health: {{aspects.monitoring.health_endpoint}}
  </div>
{{/if}}
```

### Filter by Aspect

```handlebars
{{!-- Show all instances with monitoring --}}
<h2>Monitored Services</h2>
{{#each instances}}
  {{#if aspects.monitoring}}
    <li>{{name}} - :{{aspects.monitoring.metrics_port}}</li>
  {{/if}}
{{/each}}
```

### Access Aspect Data

```handlebars
{{!-- Direct property access --}}
Backup schedule: {{aspects.backup.schedule}}
Retention: {{aspects.backup.retention_days}} days

{{!-- With default --}}
Log level: {{default aspects.logging.level "info"}}
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
  "aspects": {
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
"aspects": {
  "type": {
    "kind": "database"
  }
}

// Good
"class": "database"
```

**2. Single-Use Fields**
```json
// Bad - just use regular field
"aspects": {
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
"aspects": {
  "hierarchy": {
    "parent": "production"
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
  "id": "ports",
  "class": "aspect_base",
  "kind": "optional",
  "schema": {
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
  "id": "nginx",
  "class": "container",
  "aspects": {
    "ports": {
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
  {{id}}:
    image: {{image}}
    {{#if aspects.ports}}
    ports:
      {{#each aspects.ports.mappings}}
      - "{{host}}:{{container}}"
      {{/each}}
    {{/if}}
```

### Infrastructure Monitoring

**Monitoring Aspect:**
```json
{
  "id": "monitoring",
  "class": "aspect_base",
  "kind": "optional",
  "schema": {
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
  "id": "web-01",
  "class": "server",
  "aspects": {
    "monitoring": {
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
  "id": "db-01",
  "class": "database",
  "aspects": {
    "monitoring": {
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

Group related aspects:

```json
// Production instance
{
  "id": "api-prod",
  "class": "service",
  "aspects": {
    "monitoring": { ... },
    "backup": { ... },
    "security": { ... },
    "compliance": { ... }
  }
}

// Development instance (fewer aspects)
{
  "id": "api-dev",
  "class": "service",
  "aspects": {
    "monitoring": { ... }
  }
}
```

### Pattern 2: Conditional Rendering

```handlebars
{{!-- Only configure backup if aspect present --}}
{{#if aspects.backup}}
  backup:
    enabled: true
    schedule: {{aspects.backup.schedule}}
    retention: {{aspects.backup.retention_days}}
{{else}}
  backup:
    enabled: false
{{/if}}
```

### Pattern 3: Aspect-Driven Configuration

```handlebars
{{!-- Generate monitoring config for all monitored instances --}}
scrape_configs:
{{#each instances}}
  {{#if aspects.monitoring}}
  - job_name: {{id}}
    static_configs:
      - targets: ['{{hostname}}:{{aspects.monitoring.metrics_port}}']
    metrics_path: {{default aspects.monitoring.path "/metrics"}}
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
  "id": "logging",
  "kind": "optional",
  "defaults": {
    "level": "info",
    "format": "json"
  }
}
```

### Schema Design

**1. Required vs Optional Fields**
```json
{
  "schema": {
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
  "schema": {
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
  "id": "web-01",
  "class": "server",
  "name": "Web Server 01",
  "description": "Production web server with monitoring and backup",
  "aspects": {
    "monitoring": { ... },
    "backup": { ... }
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
  "id": "web-prod-01",
  "class": "web_server",      // Inheritance
  "parent": "server",          // IS-A server
  "aspects": {                 // Composition
    "monitoring": { ... },     // HAS monitoring
    "backup": { ... },         // HAS backup
    "ssl": { ... }             // HAS SSL
  }
}
```

---

## Common Errors

### Missing Required Aspect

```
Error: Instance "server-01" missing required aspect "security"
Applies to class: server
```

**Fix:** Add the aspect:
```json
{
  "aspects": {
    "security": {
      "firewall": true
    }
  }
}
```

### Aspect Validation Failure

```
Error: Instance "web-01" aspect "monitoring"
  Property "metrics_port" is required
```

**Fix:** Add required field:
```json
{
  "aspects": {
    "monitoring": {
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
