# Concepts: Classes & Schemas

Understanding class definitions, inheritance, and schema validation.

## Overview

In Struktur, **classes** define the structure and defaults for your data, while **schemas** enforce validation rules. Together they create a type-safe foundation for your instances.

```
Class        → Structure + Defaults
Schema       → Validation Rules  
Instance     → Actual Data
```

---

## Classes

### What is a Class?

A class is a `.schema.json` file that defines:
- A unique class name
- Optional parent class(es) for inheritance
- Default field values
- Validation schema

**Example: `classes/service.schema.json`**
```json
{
  "class": "service",
  "parent": "entity_base",
  "port": null,
  "replicas": 1,
  "status": "running",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "port": { "type": ["integer", "null"], "minimum": 1, "maximum": 65535 },
      "replicas": { "type": "integer", "minimum": 1 },
      "status": { "type": "string", "enum": ["running", "stopped", "maintenance"] }
    }
  }
}
```

### Class Fields

- `class` (required) — Unique identifier, must match filename
- `parent` (optional) — Single parent or array of parents
- `aspect_types` (optional) — Array of aspect names this class uses (accumulates through inheritance)
- `aspect_defaults` (optional) — Default values for aspect data (see [Aspect Defaults](#aspect-defaults))
- All other fields — Default values for instances

### The `class` Field Requirement

Since v0.2.0, class files **must** include a `"class"` field matching the filename:

```json
// service.schema.json
{
  "class": "service",           // ← Required, must match filename
  "parent": "entity_base",
  "port": null,
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": { ... }
  }
}
```

**Why?** Prevents errors when refactoring or moving files. The class field makes class files self-documenting and eliminates filename-based inference.

### Naming Conventions

**Class names:**
- Use `snake_case`: `web_server`, `database_cluster`
- Be specific: `blog_post` not `post`
- Avoid abbreviations unless universal: `db` ok, `svr` not

**File names:**
- Class file: `<classname>.schema.json`
- Must match class name exactly
- Contains both defaults and schema

---

## Inheritance

### Single Parent

```json
{
  "class": "web_server",
  "parent": "server",
  "framework": "express",
  "node_version": "20"
}
```

**Inheritance chain:**
```
entity_base
  └── server
      └── web_server
```

### Multiple Parents

```json
{
  "class": "production_db",
  "parent": ["database", "production_config", "monitored"]
}
```

**Merge order:** Left to right (database → production_config → monitored → production_db)

### Inheritance Rules

1. **Fields merge, not replace** — Child adds to parent
2. **Child wins conflicts** — Child values override parent
3. **Arrays append** — Unless using `$reset` (see [Instances](concepts-instances.md))
4. **Deep merge** — Objects merge recursively
5. **Schemas validate independently** — Each class in chain validates

### When to Use Inheritance

✅ **Use inheritance for:**
- IS-A relationships (`blog_post` IS-A `content`)
- Shared structure (`server` → `web_server`, `db_server`)
- Progressive specialization (base → specific)

❌ **Don't use inheritance for:**
- HAS-A relationships (use aspects instead)
- Unrelated shared fields (create separate base)
- More than 3-4 levels deep

---

## Aspect Defaults

### Defining Aspect Defaults in Classes

Classes can provide default values for aspect data using the `aspect_defaults` field:

```json
// classes/proxmox_lxc.schema.json
{
  "class": "proxmox_lxc",
  "parent": "proxmox_guest",
  "aspect_types": ["proxmox_guest", "network_interface"],
  "aspect_defaults": {
    "proxmox_guest": {
      "host_node": "polaris",
      "ostemplate": "local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst",
      "rootfs_storage": "local-lvm",
      "start": true,
      "unprivileged": true
    },
    "network_interface": {
      "bridge": "vmbr0",
      "gateway": "192.168.68.1"
    }
  },
  "schema": { ... }
}
```

### Inheritance and Accumulation

Like other class fields, `aspect_defaults` deep merge through the inheritance chain:

```json
// parent class
{
  "class": "base_container",
  "aspect_defaults": {
    "docker": {
      "restart": "unless-stopped",
      "network_mode": "bridge"
    }
  }
}

// child class
{
  "class": "web_container",
  "parent": "base_container",
  "aspect_defaults": {
    "docker": {
      "restart": "always"  // Overrides parent
      // network_mode inherited from parent
    }
  }
}
```

**Result for `web_container` instances:**
```json
{
  "docker": {
    "restart": "always",        // From child
    "network_mode": "bridge"    // From parent
  }
}
```

### Three-Layer Merge

Aspect data merges from three sources:

1. **Aspect definition defaults** (base layer)
2. **Class aspect_defaults** (class-specific overrides)
3. **Instance aspects** (highest priority)

See [Concepts: Aspects - Aspect Defaults](concepts-aspects.md#aspect-defaults) for complete details.

---

## Schemas

### What is a Schema?

The `schema` property within a class file defines validation rules using JSON Schema.

**Example: `classes/service.schema.json`**
```json
{
  "class": "service",
  "parent": "entity_base",
  "port": null,
  "replicas": 1,
  "status": "running",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "port": {
        "type": "integer",
        "minimum": 1,
        "maximum": 65535
      },
      "replicas": {
        "type": "integer",
        "minimum": 1
      },
      "status": {
        "type": "string",
        "enum": ["running", "stopped", "paused"]
      }
    },
    "required": ["port"]
  }
}
```

### Schema Validation Levels

Struktur validates at multiple levels:

**1. Structural Validation (JSON Schema)**
- Field types (string, number, boolean, object, array)
- Required fields
- Allowed properties

**2. Constraint Validation**
- Numeric bounds (minimum, maximum)
- String length (minLength, maxLength)
- Enum restrictions
- Pattern matching (regex)

**3. Format Validation**
- email, date, date-time
- ipv4, ipv6, hostname
- uri, uri-reference

**4. Semantic Validation**
- Cross-field constraints
- Data quality checks
- Best practice warnings

### Common Schema Patterns

**Required Field:**
```json
{
  "properties": {
    "name": { "type": "string" }
  },
  "required": ["name"]
}
```

**Enum Constraint:**
```json
{
  "properties": {
    "environment": {
      "type": "string",
      "enum": ["dev", "staging", "production"]
    }
  }
}
```

**Numeric Range:**
```json
{
  "properties": {
    "port": {
      "type": "integer",
      "minimum": 1024,
      "maximum": 65535
    }
  }
}
```

**String Pattern:**
```json
{
  "properties": {
    "hostname": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    }
  }
}
```

**Array with Constraints:**
```json
{
  "properties": {
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "uniqueItems": true
    }
  }
}
```

**Nested Object:**
```json
{
  "properties": {
    "database": {
      "type": "object",
      "properties": {
        "host": { "type": "string" },
        "port": { "type": "integer" }
      },
      "required": ["host", "port"]
    }
  }
}
```

---

## Class vs Schema

### When to Use Defaults (Class)

Use class defaults for values that are:
- **Universally safe** — Same for all instances
- **Reasonable fallbacks** — Good starting point
- **Non-critical** — Ok if not overridden

**Examples:**
```json
{
  "class": "server",
  "replicas": 1,          // Safe default
  "auto_restart": true,   // Reasonable default
  "log_level": "info"     // Safe default
}
```

### When to Require Values (Schema)

Use schema `required` for values that:
- **Must vary** — Different per instance/environment
- **Are critical** — System breaks if missing
- **Have no safe default** — Any default would be wrong

**Examples:**
```json
{
  "required": [
    "hostname",     // Must be unique
    "ip_address",   // Must be specific
    "port"          // Must be explicit
  ]
}
```

### Anti-Patterns

❌ **Don't do this:**
```json
// BAD: Environment-specific default
{
  "class": "database",
  "host": "prod-db.example.com"  // Wrong for dev/staging!
}
```

✅ **Do this instead:**
```json
// GOOD: Leave unset, require in schema
{
  "class": "database"
  // No host field
}

// Schema requires it
{
  "required": ["host"]
}
```

---

## Inheritance + Validation

### Multi-Pass Validation

Each class in the inheritance chain validates independently:

```
entity_base.schema.json  → Validates base fields (id, name)
    ↓
server.schema.json       → Validates server fields (hostname, ip)
    ↓
web_server.schema.json   → Validates web fields (port, ssl)
```

**Why?** Keeps schemas focused and debuggable. When validation fails, you see which schema failed.

### Schema Inheritance Rules

1. **Schemas don't inherit** — Each validates independently
2. **Required fields accumulate** — Instance must satisfy all schemas
3. **Parent validates first** — Errors show full chain
4. **No schema merging** — Each schema is complete and separate

### Example Validation Flow

**Classes:**
```json
// entity_base.json
{ "class": "entity_base", "id": "", "name": "" }

// server.json
{ "class": "server", "parent": "entity_base", "hostname": "" }

// web_server.json
{ "class": "web_server", "parent": "server", "port": 80 }
```

**Schemas:**
```json
// entity_base.schema.json
{ "required": ["id", "name"] }

// server.schema.json
{ "required": ["hostname"] }

// web_server.schema.json  
{ "required": ["port"] }
```

**Instance validation:**
```json
{
  "id": "web-01",
  "class": "web_server",
  "name": "Web Server",
  "hostname": "web-01.example.com",
  "port": 8080
}
```

Validates against:
1. `entity_base.schema.json` ✓ (has id, name)
2. `server.schema.json` ✓ (has hostname)
3. `web_server.schema.json` ✓ (has port)

---

## Best Practices

### Class Design

**1. Single Responsibility**
- Each class models one concept
- Don't create "kitchen sink" classes

**2. Shallow Hierarchies**
- 3-4 levels max
- Prefer composition (aspects) over deep inheritance

**3. Meaningful Defaults**
- Only provide defaults that are universally safe
- Leave environment-specific values unset

**4. Clear Naming**
- Class name describes the concept
- Avoid generic names (`thing`, `item`)

### Schema Design

**1. Fail Fast**
- Mark critical fields as required
- Use strict constraints

**2. Clear Constraints**
- Document why constraints exist (in comments or docs)
- Use enums for closed sets
- Use patterns for format validation

**3. Helpful Errors**
- Specific field names
- Clear constraint violations
- Example of valid values

**4. Composition Over Restriction**
- Prefer additionalProperties: false sparingly
- Use specific property definitions instead

### File Organization

```
classes/
├── entity_base.schema.json
├── server.schema.json
└── web_server.schema.json
```

**Rules:**
- One class per file (`.schema.json`)
- File contains class definition, defaults, and schema
- Alphabetical order
- Clear naming (filename must match `class` field)

---

## Advanced Topics

### Optional Parent

```json
{
  "class": "standalone_service",
  "parent": null  // No inheritance
}
```

### Conditional Fields

Use schema conditionals for variant validation:

```json
{
  "if": {
    "properties": { "type": { "const": "database" } }
  },
  "then": {
    "required": ["connection_string"]
  }
}
```

### Schema References

Reference definitions in same schema:

```json
{
  "definitions": {
    "port": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535
    }
  },
  "properties": {
    "http_port": { "$ref": "#/definitions/port" },
    "https_port": { "$ref": "#/definitions/port" }
  }
}
```

---

## Common Errors

### Missing Class Field

```
Error: Schema file "service.schema.json" missing required "class" field
Expected: "class": "service"
```

**Fix:** Add `"class"` field matching filename.

### Class/Schema Mismatch

```
Error: Class "web_server" has no schema file
Expected: classes/web_server.schema.json
```

**Fix:** Create schema file with matching name.

### Circular Inheritance

```
Error: Circular inheritance detected
Class "A" inherits from "B" which inherits from "A"
```

**Fix:** Break the cycle, create proper hierarchy.

---

## See Also

- [Concepts: Instances](concepts-instances.md) - How instances use classes
- [Concepts: Validation](concepts-validation.md) - Validation deep dive
- [Tutorial: First Stack](tutorial-first-stack.md) - Hands-on class creation
- [Errors & Troubleshooting](errors-troubleshooting.md) - Common issues
