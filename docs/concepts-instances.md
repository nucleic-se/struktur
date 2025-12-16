# Concepts: Instances

Understanding instance files, merging, and data composition.

## Overview

**Instances** are the actual data in your Struktur stack. They reference classes to inherit structure and defaults, then provide specific values for each field.

```
Class      → Template with defaults
Instance   → Actual data
Result     → Merged, validated data
```

---

## Instance Structure

### Basic Instance

**`instances/web-server.json`:**
```json
{
  "id": "web-prod-01",
  "class": "server",
  "hostname": "web-prod-01.example.com",
  "ip_address": "10.0.1.10",
  "port": 8080
}
```

### Required Fields

Every instance must have:
- `id` — Unique identifier (string)
- `class` — Class name this instance belongs to

All other fields depend on the class and schema definitions.

---

## Instance Merging

Struktur merges data from three sources:

```
1. Class defaults (from inheritance chain)
2. Instance files (multiple files with same ID)
3. Instance-specific values

Result: Fully merged instance
```

### 1. Class Inheritance Merge

Instance inherits defaults from class hierarchy:

**Classes:**
```json
// entity_base.json
{
  "class": "entity_base",
  "labels": [],
  "domain": null
}

// server.json
{
  "class": "server",
  "parent": "entity_base",
  "replicas": 1,
  "auto_restart": true
}
```

**Instance:**
```json
{
  "id": "my-server",
  "class": "server",
  "hostname": "server-01"
}
```

**Merged result:**
```json
{
  "id": "my-server",
  "class": "server",
  "hostname": "server-01",
  "replicas": 1,           // From server
  "auto_restart": true,    // From server
  "labels": [],            // From entity_base
  "domain": null           // From entity_base
}
```

### 2. Multi-File Instance Merge

Multiple files with the same `id` are merged:

**`base/app.json`:**
```json
{
  "id": "myapp",
  "class": "service",
  "port": 8080,
  "replicas": 1
}
```

**`prod/app.json`:**
```json
{
  "id": "myapp",
  "replicas": 5,
  "region": "us-east"
}
```

**Merged result:**
```json
{
  "id": "myapp",
  "class": "service",
  "port": 8080,
  "replicas": 5,        // Overridden by prod
  "region": "us-east"   // Added by prod
}
```

**Use case:** Base configuration + environment overlays

### 3. Full Merge Order

Complete merge precedence (lowest to highest):

```
1. Root parent defaults
2. Parent defaults  
3. Class defaults
4. First instance file
5. Second instance file
6. ... (all instance files)
7. Last instance file

Later sources win conflicts
```

---

## Field Types

### Primitive Values

Simple overwrite for strings, numbers, booleans, null:

```json
// Base
{ "port": 8080, "ssl": false }

// Override
{ "port": 9000, "ssl": true }

// Result
{ "port": 9000, "ssl": true }
```

### Objects

Objects merge recursively:

```json
// Base
{
  "database": {
    "host": "localhost",
    "port": 5432
  }
}

// Override
{
  "database": {
    "port": 3306,
    "name": "mydb"
  }
}

// Result
{
  "database": {
    "host": "localhost",  // Kept from base
    "port": 3306,         // Overridden
    "name": "mydb"        // Added
  }
}
```

### Arrays

**Default behavior:** Arrays **append**:

```json
// Base
{ "tags": ["web", "nginx"] }

// Override
{ "tags": ["production"] }

// Result
{ "tags": ["web", "nginx", "production"] }
```

**Reset behavior:** Use `$reset` to replace:

```json
// Base
{ "tags": ["web", "nginx"] }

// Override with reset
{
  "tags": {
    "$reset": true,
    "values": ["production", "critical"]
  }
}

// Result
{ "tags": ["production", "critical"] }
```

---

## Tag References

Instances can reference other instances using tags:

### Syntax

```json
{
  "id": "web-server",
  "class": "server",
  "load_balancer": "@lb-01",
  "domain": "@production"
}
```

**Tag format:** `@<instance-id>`

### Reference Types

**One-to-One:**
```json
{
  "id": "app",
  "class": "service",
  "database": "@postgres-prod"
}
```

**One-to-Many:**
```json
{
  "id": "cluster",
  "class": "cluster",
  "servers": ["@web-01", "@web-02", "@web-03"]
}
```

**Hierarchical (domain):**
```json
{
  "id": "web-team",
  "class": "team",
  "domain": "@engineering"
}
```

### Resolution

Tags are stored as strings in canonical output. Templates can:
1. Use tags directly (as IDs)
2. Look up referenced instances from `instances_by_id`
3. Use future `resolve` helper (planned)

**Example template usage:**
```handlebars
{{!-- Show database reference --}}
Database: {{database}}

{{!-- Look up full database instance --}}
{{#with (lookup ../instances_by_id database)}}
  Database: {{name}} at {{host}}:{{port}}
{{/with}}
```

---

## Special Fields

### `id` Field

- **Type:** String
- **Required:** Yes
- **Unique:** Yes
- **Purpose:** Identifies instance, enables merging and references

**Rules:**
- Must be unique across all instances
- Use `snake_case` or `kebab-case`
- Be descriptive: `web-prod-01` not `server1`
- No spaces or special characters (except `-` and `_`)

### `class` Field

- **Type:** String
- **Required:** Yes
- **Purpose:** Links instance to class definition

**Rules:**
- Must match existing class name exactly
- Case-sensitive
- Only in first file when merging (subsequent files omit it)

### `domain` Field

If using Universal:
- **Type:** String (tag reference)
- **Purpose:** Hierarchical organization
- **Format:** `@<domain-id>` or null

**Example:**
```json
{
  "id": "web-01",
  "class": "server",
  "domain": "@web-tier"
}
```

### `labels` Field

If using Universal:
- **Type:** Array of strings
- **Purpose:** Categorization and filtering
- **Merges:** Appends by default

**Example:**
```json
{
  "id": "web-01",
  "class": "server",
  "labels": ["production", "nginx", "us-east"]
}
```

---

## Multi-Environment Patterns

### Pattern 1: Directory Layering

```
instances/
├── base/          # Common to all environments
│   └── app.json
├── dev/           # Development overrides
│   └── app.json
└── prod/          # Production overrides
    └── app.json
```

**Build:**
```bash
# Development
struktur build -i instances/base instances/dev

# Production
struktur build -i instances/base instances/prod
```

### Pattern 2: Environment Files

```
instances/
├── app-base.json       # Common config
├── app-dev.json        # Dev-specific (same ID)
└── app-prod.json       # Prod-specific (same ID)
```

**Each file:**
```json
// app-base.json
{ "id": "myapp", "class": "service", "port": 8080 }

// app-dev.json
{ "id": "myapp", "replicas": 1, "debug": true }

// app-prod.json
{ "id": "myapp", "replicas": 10, "debug": false }
```

### Pattern 3: Mixins

```bash
struktur build base-stack prod-mixin monitoring-mixin
```

Each directory adds/overrides instances with same IDs.

---

## Instance Organization

### By Type (Recommended)

```
instances/
├── servers/
│   ├── web-01.json
│   ├── web-02.json
│   └── db-01.json
├── networks/
│   ├── frontend.json
│   └── backend.json
└── domains/
    └── production.json
```

**Pros:**
- Easy to find instances by type
- Clear organization
- Natural grouping

### By Environment

```
instances/
├── dev/
│   ├── web.json
│   └── db.json
├── staging/
│   ├── web.json
│   └── db.json
└── prod/
    ├── web.json
    └── db.json
```

**Pros:**
- Environment isolation
- Clear boundaries
- Easy to build per-env

### Flat (Simple Stacks)

```
instances/
├── app.json
├── database.json
└── cache.json
```

**Pros:**
- Simple for small stacks
- No nesting needed
- Quick to navigate

---

## Best Practices

### Instance Design

**1. Descriptive IDs**
```json
// Good
{ "id": "web-prod-us-east-01" }

// Bad
{ "id": "server1" }
```

**2. Complete Data**
- Don't rely on defaults for critical values
- Make important values explicit
- Use required fields in schema

**3. Consistent Structure**
- Same fields across similar instances
- Use same naming conventions
- Group related data in objects

### Merging Strategy

**1. Base + Overlay**
```
base/         # Shared defaults
env/dev/      # Dev-specific
env/prod/     # Prod-specific
```

**2. Layer Order Matters**
```bash
# Later directories override earlier
struktur build base overlay custom
```

**3. Use $reset Sparingly**
- Only when array replacement is truly needed
- Document why reset is used
- Consider if separate instance is better

### Tag References

**1. Validate References**
- Ensure referenced IDs exist
- Use consistent tag format
- Document relationships

**2. Avoid Circular References**
```json
// BAD
{ "id": "a", "ref": "@b" }
{ "id": "b", "ref": "@a" }
```

**3. Use Hierarchical Domains**
```json
{ "id": "production", "class": "domain_root" }
{ "id": "web-tier", "domain": "@production" }
{ "id": "web-01", "domain": "@web-tier" }
```

---

## Advanced Patterns

### Computed Values

Templates can compute derived values:

```handlebars
{{!-- Generate FQDN from hostname and domain --}}
{{hostname}}.{{lookup ../domains_by_id domain "name"}}.com
```

### Conditional Merging

Use labels for conditional configuration:

```json
{
  "id": "app",
  "class": "service",
  "labels": ["ssl-enabled"]
}
```

**In template:**
```handlebars
{{#if (whereIncludes labels "ssl-enabled")}}
  ssl_certificate: /etc/ssl/cert.pem
{{/if}}
```

### Instance Families

Group related instances:

```json
// web-01.json
{
  "id": "web-01",
  "class": "web_server",
  "cluster": "web-cluster",
  "index": 1
}

// web-02.json
{
  "id": "web-02",
  "class": "web_server",
  "cluster": "web-cluster",
  "index": 2
}
```

**Filter in template:**
```handlebars
{{#each (where instances "cluster" "web-cluster")}}
  - {{id}}: {{hostname}}
{{/each}}
```

---

## Common Errors

### Missing Required Fields

```
Error: Instance "my-server" missing required field "hostname"
Schema: server.schema.json
```

**Fix:** Add the required field:
```json
{
  "id": "my-server",
  "class": "server",
  "hostname": "server-01.example.com"
}
```

### Duplicate IDs

```
Error: Duplicate instance ID "web-01"
Found in:
  - instances/servers/web-01.json
  - instances/backup/web-01.json
```

**Fix:** Either:
1. Rename one instance
2. Use multi-file merge (intentional override)

### Unknown Class

```
Error: Instance "my-app" references unknown class "application"
Available classes: service, server, database
```

**Fix:** Create the class or fix the class name:
```json
{
  "id": "my-app",
  "class": "service"  // Use existing class
}
```

### Type Mismatch

```
Error: Instance "app" field "port" expected integer, got string
Value: "8080"
```

**Fix:** Remove quotes:
```json
{
  "id": "app",
  "class": "service",
  "port": 8080  // Number, not string
}
```

---

## Validation Tips

### Check Before Building

```bash
# Validate instances first
struktur validate -c classes/ -i instances/

# Then build
struktur build -c classes/ -i instances/ -t templates/
```

### JSON Output for Debugging

```bash
struktur validate -c classes/ -i instances/ --json | jq .
```

### Inspect Canonical Output

```bash
struktur generate -c classes/ -i instances/ -o debug.json
cat debug.json | jq '.instances[] | {id, class}'
```

---

## See Also

- [Concepts: Classes & Schemas](concepts-classes-schemas.md) - Class design
- [Concepts: Validation](concepts-validation.md) - How validation works
- [Tutorial: First Stack](tutorial-first-stack.md) - Create instances step-by-step
- [Errors & Troubleshooting](errors-troubleshooting.md) - Common issues
