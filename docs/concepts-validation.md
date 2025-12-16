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

Struktur performs validation in four independent passes:

### 1. Structural Validation (JSON Schema)

Checks basic structure and types:
- Field presence (required fields)
- Data types (string, number, boolean, object, array)
- Additional properties handling

**Example:**
```json
// Schema requires "name"
{
  "required": ["name"]
}

// Instance missing "name" → Structural validation fails
{
  "id": "app",
  "class": "service"
}
```

### 2. Constraint Validation

Validates bounds and restrictions:
- Numeric ranges (minimum, maximum)
- String lengths (minLength, maxLength)
- Enum restrictions
- Pattern matching (regex)
- Array constraints (minItems, maxItems, uniqueItems)

**Example:**
```json
// Schema has constraint
{
  "properties": {
    "port": {
      "type": "integer",
      "minimum": 1024,
      "maximum": 65535
    }
  }
}

// Instance violates constraint → Constraint validation fails
{
  "port": 80  // Below minimum
}
```

### 3. Semantic Validation

Checks data quality:
- Format validation (email, date, ipv4, hostname, uri)
- Empty field detection (empty strings in display fields)
- Type coercion issues (numbers as strings)
- Suspicious values (placeholders, TODOs)

**Example:**
```json
// Schema specifies format
{
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  }
}

// Instance has invalid format → Semantic warning
{
  "email": "not-an-email"
}
```

### 4. Canonical Validation

Validates final output structure:
- Canonical JSON shape correctness
- Required top-level fields (instances, classes, aspects)
- Metadata presence
- Array integrity

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
