# Concepts: Validation

Understanding Struktur's multi-layer validation system.

## Overview

Struktur validates data at multiple levels before generating any output. This fail-fast approach catches errors early, preventing invalid configurations from reaching production.

```
Load → Merge → Validate → Render
              ↑
         Validation happens here
         (before any files written)
```

---

## Validation Layers

Struktur performs validation in five independent passes:

### Pass 0: Base Schema Validation (Universal Contract)

Validates that **all instances** meet the universal contract:
- Required fields: `id`, `class`
- Optional fields: `render` (instance-specific render tasks)
- Schema: `schemas/instance_base.schema.json`

**Level:** Error (validation fails)

**Why first?** Catches fundamental structural errors (missing id/class) before any class-specific validation runs.

See [Base Schema Validation](#base-schema-validation-pass-0) for details.

### Pass 1: Schema Validation (JSON Schema)

Checks basic structure and types:
- Field presence (required fields)
- Data types (string, number, boolean, object, array)
- Additional properties handling
- Schema constraints (min/max, patterns, enums)

**Level:** Error (validation fails)

**Example:**
```json
// Schema requires "name"
{
  "required": ["name"]
}

// Instance missing "name" → Schema validation fails
{
  "id": "app",
  "class": "service"
}
```

### Pass 2: Aspect Validation

Validates aspect-specific requirements:
- Required aspect fields are present
- Aspect field types match schema
- Aspect-specific constraints satisfied

**Level:** Error (validation fails)

**Example:**
```json
// terraform aspect requires "resource_type"
{
  "required": ["resource_type"]
}

// Instance missing aspect field → Aspect validation fails
{
  "id": "vm-01",
  "aspects": ["terraform"]
  // Missing: resource_type
}
```

### Pass 3: Semantic Validation ⚠️

Checks data formats and quality (warnings only):
- Format validation: `email`, `uri`, `hostname`, `ipv4`, `port`
- Empty field detection (name, description, display_name)
- Placeholder detection (TODO, FIXME, XXX, TBD)

**Level:** Warning (does not fail validation)

**Example:**
```json
// Instance with format issue → Semantic warning
{
  "id": "srv-01",
  "name": "TODO: Add proper name",  // Warning: placeholder_value
  "email": "not-an-email",           // Warning: invalid_format
  "hostname": "UPPERCASE.COM"        // Warning: invalid_format (should be lowercase)
}
```

### Pass 4: Lint Validation 🔍

Checks data quality and conventions (warnings only):
- Missing descriptions
- Malformed IDs (not kebab-case)
- Empty arrays in tags/categories/labels
- Suspicious values (port 0, empty name)

**Level:** Warning (does not fail validation)

**Example:**
```json
// Instance with lint issues → Lint warnings
{
  "id": "MyService_01",    // Warning: malformed_id (should be kebab-case)
  "name": "",              // Warning: suspicious_value (empty name)
  "port": 0,               // Warning: suspicious_value (port 0)
  "tags": []               // Warning: empty_array
  // Missing: description   // Warning: missing_description
}
```

---

## Errors vs Warnings

**Errors** (validation fails):
- Base schema violations (Pass 0) - missing id/class, malformed render array
- Schema violations (Pass 1)
- Aspect requirement violations (Pass 2)
- Result: `valid: false`, build stops

**Warnings** (validation passes):
- Semantic format issues (Pass 3)
- Lint quality issues (Pass 4)
- Result: `valid: true`, warnings shown but build continues

**Control Flags:**
```javascript
const validator = new MultiPassValidator({
  enableSemantic: true,  // Enable Pass 3 (default: true)
  enableLint: true       // Enable Pass 4 (default: true)
});
```

**Note:** Pass 0 (base schema) and Pass 1-2 (class/aspect schemas) cannot be disabled - they are fundamental to structural integrity.

---

## Base Schema Validation (Pass 0)

Before any class-specific validation, **all instances** are validated against the universal base schema (`schemas/instance_base.schema.json`).

**Required fields:**
- `id` (string, minLength: 1) - Unique instance identifier
- `class` (string, minLength: 1) - Class name

**Optional fields:**
- `render` (array) - Instance-specific render tasks (see [Render Arrays](./concepts-instances.md#render-arrays))

**Example base schema errors:**

```json
// Missing id
{
  "class": "server",
  "name": "My Server"
}
// Error: Base schema validation failed for instance 'undefined' - missing required property 'id'

// Empty id
{
  "id": "",
  "class": "server"
}
// Error: Base schema validation failed for instance '' - 'id' must be at least 1 character

// Invalid render array
{
  "id": "web-01",
  "class": "server",
  "render": [{"template": "config.hbs"}]  // missing 'output'
}
// Error: Base schema validation failed for instance 'web-01' - render[0] missing required property 'output'
```

**Why Pass 0?** Ensures all instances meet the universal contract before any class-specific validation runs. This catches fundamental structural errors early with clear, specific messages.

---

## Multi-Pass Class Validation

Each class in the inheritance chain validates independently:

```
entity_base.schema.json
  ↓ validates base fields
server.schema.json
  ↓ validates server fields
web_server.schema.json
  ↓ validates web-specific fields
```

**Why?** Keeps schemas focused and makes errors easier to debug.

**Example:**

**Classes:**
```json
// entity_base.json + schema
{
  "required": ["id", "name"]
}

// server.json + schema  
{
  "required": ["hostname", "ip_address"]
}

// web_server.json + schema
{
  "required": ["port"]
}
```

**Instance validation:**
```json
{
  "id": "web-01",
  "class": "web_server",
  "name": "Web Server 01"
}
```

**Validation errors:**
```
✗ Validation failed

Error (instance: web-01)
  Schema: server.schema.json
  Missing required: hostname, ip_address

Error (instance: web-01)
  Schema: web_server.schema.json
  Missing required: port
```

**Key point:** Errors show which schema failed, making debugging easier.

---

## Validation Strictness

### Default Behavior

**Strict by default:**
- Schema warnings → errors (`--warnings-as-errors=true`)
- Extra fields → warnings (`--warn-extra-fields=true`)
- Constraint conflicts → always errors (no opt-out)

**Warnings vs Errors:**
- Schema validation warnings → promoted to errors
- Semantic validation → remains warnings (informational)
- Lint checks → remains warnings

### Error Types

**Hard Errors (Build fails):**
- Missing required fields
- Type mismatches
- Constraint violations (when strict)
- Circular inheritance
- Unknown class references

**Warnings (Informational):**
- Extra fields not in schema
- Empty display fields
- Suspicious placeholder values
- Format validation issues (semantic)

---

## Validation Messages

### Error Structure

```
[VALIDATE] Validation Error (instance: web-01)
  Property "port" is required but not provided
  Schema: server.schema.json
  Class: web_server (inherits: entity_base → server → web_server)
```

**Components:**
- **Phase:** `[VALIDATE]` - Where error occurred
- **Instance:** `web-01` - Which instance failed
- **Property:** `port` - Which field caused error
- **Schema:** `server.schema.json` - Which schema failed
- **Context:** Class lineage for debugging

### Constraint Conflict Example

```
[VALIDATE] Schema constraint conflicts detected in class container:
  - TYPE_CONFLICT: domain_infrastructure/container
    Path: ports[*]
    Parent universal_base requires string
    Parent docked_container requires object
    No compatible types remain after merge
```

**What this means:**
- Two parent classes have incompatible constraints
- One requires string, other requires object
- No value can satisfy both
- Fix by resolving constraint in schemas

---

## Validation Commands

### Validate Before Building

```bash
# Always validate first
struktur validate -c classes/ -i instances/

# Then build
struktur build -c classes/ -i instances/ -t templates/
```

### JSON Output

```bash
# Machine-readable output
struktur validate -c classes/ -i instances/ --json

# Parse with jq
struktur validate . --json | jq '.errors[] | .message'
```

### Quiet Mode

```bash
# Exit code only (for CI/CD)
if struktur validate . --quiet; then
  echo "Valid"
else
  echo "Invalid" >&2
  exit 1
fi
```

---

## Schema Constraint Types

### Type Constraints

```json
{
  "type": "string"           // Must be string
  "type": "integer"          // Must be integer (not float)
  "type": "number"           // Can be integer or float
  "type": "boolean"          // Must be true/false
  "type": "object"           // Must be object
  "type": "array"            // Must be array
  "type": ["string", "null"] // Can be string or null
}
```

### Numeric Constraints

```json
{
  "type": "integer",
  "minimum": 1,              // >= 1
  "maximum": 100,            // <= 100
  "exclusiveMinimum": 0,     // > 0
  "exclusiveMaximum": 100,   // < 100
  "multipleOf": 5            // Must be multiple of 5
}
```

### String Constraints

```json
{
  "type": "string",
  "minLength": 1,            // At least 1 character
  "maxLength": 100,          // At most 100 characters
  "pattern": "^[a-z0-9-]+$", // Regex pattern
  "format": "email"          // Predefined format
}
```

### Array Constraints

```json
{
  "type": "array",
  "items": { "type": "string" },  // All items must be strings
  "minItems": 1,                  // At least 1 item
  "maxItems": 10,                 // At most 10 items
  "uniqueItems": true             // No duplicates
}
```

### Enum Constraints

```json
{
  "type": "string",
  "enum": ["dev", "staging", "production"]
}
```

### Object Constraints

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "integer" }
  },
  "required": ["name"],
  "additionalProperties": false  // No extra fields
}
```

---

## Format Validation

Supported formats (semantic validation):

**Email:**
```json
{ "format": "email" }
// Valid: user@example.com
// Invalid: not-an-email
```

**Date/Time:**
```json
{ "format": "date" }       // 2025-12-16
{ "format": "date-time" }  // 2025-12-16T10:30:00Z
{ "format": "time" }       // 10:30:00
```

**Network:**
```json
{ "format": "ipv4" }       // 192.168.1.1
{ "format": "ipv6" }       // 2001:db8::1
{ "format": "hostname" }   // example.com
```

**URI:**
```json
{ "format": "uri" }          // https://example.com/path
{ "format": "uri-reference" } // /path/to/resource
```

---

## Common Validation Patterns

### Required Fields from Parent

```json
// Parent schema
{
  "class": "entity_base",
  "required": ["id", "name"]
}

// Child schema (adds more required)
{
  "class": "server",
  "required": ["hostname"]
}

// Instance must have: id, name, hostname
```

### Optional vs Required

```json
{
  "properties": {
    "name": { "type": "string" },      // Optional
    "port": { "type": "integer" }      // Optional
  },
  "required": ["name"]                 // name required, port optional
}
```

### Conditional Validation

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

**Means:** If `type` is "database", then `connection_string` is required.

### Dependency Validation

```json
{
  "dependencies": {
    "ssl": ["certificate", "private_key"]
  }
}
```

**Means:** If `ssl` field is present, then `certificate` and `private_key` are required.

---

## Debugging Validation Errors

### Step 1: Identify Which Schema Failed

```
Error (instance: web-01)
  Schema: server.schema.json  ← This schema
  Missing required: hostname
```

### Step 2: Check Class Lineage

```bash
struktur info -c classes/
```

Look for:
```
web_server
  parent: server
  parent: entity_base
```

### Step 3: Inspect Merged Data

```bash
struktur generate -c classes/ -i instances/ -o debug.json
cat debug.json | jq '.instances[] | select(.id == "web-01")'
```

See what fields actually got merged.

### Step 4: Add Missing Data

```json
{
  "id": "web-01",
  "class": "web_server",
  "hostname": "web-01.example.com"  // Add missing field
}
```

---

## Validation Best Practices

### Schema Design

**1. Explicit Required Fields**
```json
// Good - clear what's required
{
  "required": ["name", "port", "host"]
}

// Bad - everything optional (typos go unnoticed)
{
  "required": []
}
```

**2. Sensible Constraints**
```json
// Good - realistic bounds
{
  "port": {
    "type": "integer",
    "minimum": 1,
    "maximum": 65535
  }
}

// Bad - overly restrictive
{
  "port": {
    "type": "integer",
    "enum": [80, 443]  // Can't use any other port!
  }
}
```

**3. Clear Error Messages**
Use `description` and `title` in schemas:

```json
{
  "properties": {
    "replicas": {
      "type": "integer",
      "minimum": 1,
      "description": "Number of replicas to run (must be positive)"
    }
  }
}
```

### Instance Design

**1. Validate Early, Validate Often**
```bash
# After every change
struktur validate .
```

**2. Test Edge Cases**
- Minimum values
- Maximum values
- Boundary conditions
- Empty arrays/objects
- Null values

**3. Use JSON Linters**
```bash
# Catch JSON syntax errors before Struktur
jq . instances/*.json
```

---

## Advanced Validation

### Custom Constraints

Use `allOf`, `anyOf`, `oneOf`:

```json
{
  "oneOf": [
    { "properties": { "type": { "const": "file" } }, "required": ["path"] },
    { "properties": { "type": { "const": "url" } }, "required": ["url"] }
  ]
}
```

**Means:** Either (type=file AND path) OR (type=url AND url).

### Schema Composition

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

### Not Constraints

```json
{
  "properties": {
    "name": {
      "type": "string",
      "not": { "enum": ["admin", "root", "system"] }
    }
  }
}
```

**Means:** name cannot be "admin", "root", or "system".

---

## Validation Errors by Type

### Missing Required Field

```
Property "port" is required but not provided
```

**Fix:** Add the field to instance.

### Type Mismatch

```
Property "port" expected type "integer" but got "string"
Value: "8080"
```

**Fix:** Remove quotes (8080 not "8080").

### Constraint Violation

```
Property "replicas" value -1 violates minimum constraint (1)
```

**Fix:** Use valid value (>= 1).

### Format Validation

```
Property "email" value "not-email" does not match format "email"
```

**Fix:** Use valid email address.

### Extra Fields Warning

```
Warning: Instance "app" has extra property "subtitle"
Class "service" schema does not define this property
```

**Fix:** Either add to schema or remove from instance.

---

## See Also

- [Concepts: Classes & Schemas](concepts-classes-schemas.md) - Schema design
- [Concepts: Instances](concepts-instances.md) - Instance structure
- [Errors & Troubleshooting](errors-troubleshooting.md) - Common validation errors
- [CLI Reference](cli-reference.md) - Validation commands
