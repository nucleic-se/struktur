# Struktur

**Type-safe build engine for structured data.** Struktur transforms validated JSON data into generated code, configuration files, documentation, or any text-based output. Define data schemas with JSON Schema, create instances with multi-parent inheritance and aspect composition, then render outputs through Handlebars or Nunjucks templates. Built for infrastructure-as-code, static sites, and any workflow where type safety and deterministic builds matter.

[![npm version](https://img.shields.io/npm/v/@nucleic-se/struktur.svg)](https://www.npmjs.com/package/@nucleic-se/struktur)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## How It Works

Struktur's pipeline has three stages:

### 1. Define Shapes (Classes + Schemas)

Classes describe the **structure** of your data. Each class file (`.schema.json`) contains the class definition with inheritance, field defaults, and JSON Schema validation rules.

```json
// classes/service.schema.json
{
  "class": "service",
  "parent": "base",
  "replicas": 1,
  "port": null,
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["id", "port"],
    "properties": {
      "id": { "type": "string" },
      "port": { "type": "integer", "minimum": 1, "maximum": 65535 },
      "replicas": { "type": "integer", "minimum": 1 }
    }
  }
}
```

Classes provide defaults only when those defaults are **universally safe**. If a value needs to vary by environment, leave it unset so instances must provide it.

### 2. Provide Data (Instances)

Instances are the **real objects**—your actual services, networks, teams, whatever you're modeling. Each instance references a class and fills in the values that class defines.

```json
// instances/web-prod.json
{
  "id": "web-prod",
  "class": "service",
  "port": 8080,
  "replicas": 3
}
```

Instances inherit defaults from their class. Struktur merges them together and validates the result against the schema. If `port` is missing or `replicas` is negative, validation fails before any files are written.

### 3. Render Outputs (Templates)

Templates turn the merged data into files. Struktur uses Handlebars by default, but the template engine is swappable. Templates see the fully merged, validated data and can generate anything: YAML configs, HTML documentation, shell scripts, Terraform manifests.

```handlebars
{{!-- templates/docker-compose.yml --}}
services:
  {{id}}:
    image: nginx:latest
    ports:
      - "{{port}}:80"
    deploy:
      replicas: {{replicas}}
```

Run `struktur build`, and Struktur:

1. Loads classes and schemas
2. Merges instances with class defaults
3. Validates everything against schemas
4. Renders templates into `build/`

## When to Use Struktur

Struktur shines when you need:

- **Multi-environment configs**: Same shapes, different values for dev/staging/prod
- **Schema-validated data**: Catch mistakes before deployment
- **Composable stacks**: Reusable bases plus domain overlays
- **Auditable builds**: Deterministic outputs you can diff and archive
- **Template-driven generation**: Render the same data into multiple formats (YAML, HTML, scripts)

**It's less useful for:**

- One-off scripts that don't need validation or reusability
- Highly dynamic data that can't be pre-validated
- Systems where build-time validation isn't practical

**Core principles:**
- **Type-safe** — JSON Schema validation catches errors before deployment
- **Deterministic** — Same inputs always produce identical outputs
- **Composable** — Multi-parent inheritance + aspect-based composition
- **Auditable** — Full transparency into what was merged and how

## Installation

### Global Installation (Recommended)

```bash
npm install -g @nucleic-se/struktur@alpha
```

### Local Installation

```bash
npm install --save-dev @nucleic-se/struktur@alpha
```

### Verify Installation

```bash
struktur --version
```

## Quick Start

### 1. Initialize from Example

```bash
struktur init my-project
cd my-project
```

Available examples:
- **universal** — Foundation with entity-aspect-domain patterns
- **docked** — Docker container management with docker-compose generation
- **skribe** — Static site generator with structured content

### 2. Validate Your Stack

```bash
struktur validate -c classes/ -i instances/
```

### 3. Generate Outputs

```bash
struktur build \
  -c classes/ \
  -i instances/ \
  -t templates/ \
  -b build/ \
  --exact \
  --engine handlebars
```



## Commands

### `validate`

Validate instances against class schemas:

```bash
# Stack directory mode (auto-discovers classes/, instances/, aspects/)
struktur validate .

# Explicit paths
struktur validate -c classes/ -i instances/ -a aspects/

# JSON output for CI/CD
struktur validate -c classes/ -i instances/ --json
```

### `build`

Generate validated outputs from templates:

```bash
struktur build \
  -c classes/ \
  -i instances/ \
  -t templates/ \
  -b build/ \
  --engine handlebars

# With aspects
struktur build \
  -c classes/ \
  -a aspects/ \
  -i instances/ \
  -t templates/ \
  -b build/output
```

### `generate`

Generate canonical data without rendering templates:

```bash
struktur generate \
  -c classes/ \
  -i instances/ \
  -o canonical.json
```

### `info`

Display information about loaded classes:

```bash
struktur info -c classes/
```

### `init`

Initialize new project from example:

```bash
struktur init --example docked my-stack
```

## Validation System

Struktur validates instances through multiple layers:

1. **JSON Schema validation**: Structural correctness (required fields, types, additionalProperties)
2. **Semantic validation**: Data quality checks (minLength, maxLength, enum, bounds, format validation)
3. **Lint checks**: Best practices and common issues (empty fields, suspicious formats)
4. **Canonical shape validation**: Output structure integrity

The validation system checks:

- **Missing required fields** — Fails if schema declares a field as required
- **Extra fields** — Warns about fields not in schema (with `--warn-extra-fields`)
- **Type mismatches** — Ensures string/number/boolean/object types match schema
- **String length bounds** — Validates minLength, maxLength constraints
- **Numeric bounds** — Validates minimum, maximum constraints
- **Enum restrictions** — Value must be in allowed list
- **Format patterns** — email, date, date-time format validation
- **Type coercion issues** — Numbers stored as strings
- **Empty display fields** — Warns about empty titles, names, descriptions
- **Suspicious values** — Detects placeholder text and common mistakes

By default, schema validation warnings are promoted to errors (`--warnings-as-errors=true`). Semantic and lint checks remain warnings—they're informational, not failures.

## What Makes Struktur Different

Struktur isn't a config language, a DSL, or a framework. It's a **composable data pipeline** for deterministic modeling and text generation.

### How Struktur Compares

**vs. Config/IaC tools** (Terraform, Ansible, Puppet):
- They provide runtime execution, providers, and state management
- Struktur provides **build-time composition and validation**
- **Use together**: Struktur generates their config files from validated models

**vs. Kubernetes packaging** (Helm, Kustomize):
- They support overlays/templates but are domain-bound to K8s
- Struktur is **domain-free** and **schema-driven** for any structured data
- **Use together**: Struktur can generate Helm charts or Kustomize overlays

**vs. Schema/modeling tools** (JSON Schema validators, Protobuf):
- They validate shapes but don't compose data or generate artifacts
- Struktur **unifies composition, validation, and generation** in one pipeline
- **Use together**: Struktur uses JSON Schema internally, can generate Protobuf definitions

**vs. Templating engines** (Handlebars, Jinja, Mustache):
- They render text but lack composition and validation
- Struktur adds the **missing data pipeline** before rendering
- **Use together**: Struktur uses Handlebars internally (swappable)

**vs. Scaffolding/build tools** (Yeoman, Cookiecutter, Make):
- They automate tasks but aren't data-centric
- Struktur is designed around **deterministic model assembly**
- **Use together**: Struktur can be the data engine behind your scaffolding

### The Bottom Line

Struktur **feeds and complements** domain-specific tools rather than replacing them. It's a build-time data pipeline that ensures your inputs are clean, valid, and composable before anything gets deployed.

This separation means:

- **No vendor lock-in**: Your data is JSON. Your templates are Handlebars (or whatever you swap in). No proprietary formats.
- **Inspectable builds**: Open `canonical.json` and see exactly what Struktur merged together.
- **Composable design**: Layer stacks, override templates, extend classes—all without forking.
- **Fail-fast validation**: Errors surface at build time with clear messages and line numbers.

## Architecture

### Build Pipeline

Struktur executes builds through four deterministic phases:

```
1. LOAD      → Discover classes, aspects, instances from directories
2. MERGE     → Combine data following inheritance and merge rules
3. VALIDATE  → Check schemas, constraints, canonical structure
4. RENDER    → Execute templates with validated data
```

Each phase is independent and can be inspected:
- **Load Phase**: Creates class definitions with schemas and lineage
- **Merge Phase**: Produces canonical.json with fully resolved instances
- **Validate Phase**: Runs JSON Schema, constraint checks, semantic validation
- **Render Phase**: Generates final outputs from templates

**Error Handling**: Errors include phase labels, file paths, and class/instance context. Use `--quiet` to suppress progress logs while keeping error details.

### Template System

Templates are **read-only** by design. They receive validated data and generate outputs but cannot modify the canonical data model.

**Template Context** (available in all templates):
```javascript
{
  global,              // Global instance (id: "global")
  instances,           // Array of all instances
  instances_by_id,     // Map for lookups by ID
  canonical,           // Full canonical structure
  classes_by_id,       // Class definitions (for inheritance checks)
  // ...plus all canonical fields spread at top level
}
```

**Template Helpers** (three categories):

1. **Generic Helpers** — Pure functions, no context needed
   - Logic: `eq`, `or`, `and`, `not`
   - Collections: `where`, `whereIncludes`, `sortBy`, `groupBy`, `pluck`
   - Strings: `concat`, `replace`, `slugify`, `lowercase`, `uppercase`
   - Utility: `length`, `defaultTo`

2. **Struktur Helpers** — Need class/schema context
   - `inherits(className, targetClass)` — Check inheritance
   - `filterInherits(instances, targetClass)` — Filter by class
   - `classLineage(className)` — Get full lineage array
   - `schemaRequired(className, field)` — Check if field required
   - `schemaHas(className, field)` — Check if field exists in schema
   - `schemaProps(className)` — Get all schema properties

3. **Engine Helpers** — Need build context
   - `render_file(template, outputPath)` — Generate separate output files
   - `partial_exists(partialName)` — Check if partial template exists

**Path Safety**: All output paths are resolved relative to build directory. Attempts to write outside build directory fail immediately with clear error messages.

**Template Collision Detection**: When multiple template directories contain files with the same relative path, Struktur detects the collision and fails by default (strict mode). This catches unintentional duplicates and ensures explicit intent.

- **Default behavior**: Collisions cause build failure with detailed report
- **Override pattern**: Use `--allow-template-collisions` to permit layering (last directory wins)
- **Collision report**: Shows which directories have the same template and which one will be used

Example collision error:
```
⚠ 1 template collision(s) detected:

Template: layouts/page.hbs
Sources:
  overridden: examples/base/templates
  → USED: examples/custom/templates

Note: Later directories override earlier ones in search path order.
      Collisions fail by default. Use --allow-template-collisions to permit.
```

This strict-by-default approach prevents silent overwrites while still supporting intentional template layering when needed.

### Helper Extension

Add custom helpers through the HelperRegistry:

```javascript
import { HelperRegistry } from './src/template_helpers/index.js';

const registry = new HelperRegistry();

// Generic helper (pure function)
registry.register('myHelper', (value) => {
  return value.toUpperCase();
}, { category: 'generic' });

// Struktur helper (needs context)
registry.register('hasPort', (context, className) => {
  return context.classes_by_id[className]?.fields?.port !== undefined;
}, { 
  category: 'struktur',
  requiresContext: true 
});

// Register to adapter
registry.registerToAdapter(handlebarsAdapter, strukturContext, buildContext);
```

**Binding Rules**:
- Generic helpers: Called directly with arguments
- Struktur helpers: First argument is bound to `{ classes_by_id, canonical }`
- Engine helpers: Receive `{ buildDir, outputs, log, adapter }`

### Validation Architecture

Validation runs in multiple passes to maintain separation of concerns:

1. **Structural Validation** (JSON Schema, per-class)
   - Each class validates independently
   - Parent schemas checked first, then child schemas
   - Keeps schemas separate for debugging and extensibility

2. **Constraint Validation** (cross-schema conflicts)
   - Detects impossible constraint combinations
   - Examples: min > max, disjoint enums, incompatible types
   - Fails immediately when conflicts detected (strict by default)

3. **Semantic Validation** (data quality)
   - Format checks (email, date, hostname, IP, URL)
   - Length bounds (minLength, maxLength, minItems, maxItems)
   - Enum restrictions and type correctness
   - Warnings by default (informational, not failures)

4. **Canonical Validation** (output structure)
   - Validates the final canonical.json structure
   - Ensures instances/classes/aspects arrays present
   - Checks for required metadata and domain structure

**Strictness Policy**: Schema validation warnings become errors by default (`--warnings-as-errors=true`). Semantic validation remains warnings. Constraint conflicts always fail (no opt-out).

### Merge Semantics

Instances merge through three mechanisms:

1. **Multi-file Merging** (same ID across files)
   ```json
   // base/app.json
   { "id": "app", "class": "service", "port": 8080 }
   
   // prod/app.json
   { "id": "app", "replicas": 5 }
   
   // Result: { id: "app", class: "service", port: 8080, replicas: 5 }
   ```

2. **Class Inheritance** (parent → child defaults)
   ```json
   // Parent "service" has: { port: 8080, replicas: 1 }
   // Child "web_service" adds: { ssl: true }
   // Instance gets: { port: 8080, replicas: 1, ssl: true }
   ```

3. **Array Merging** (append by default, reset with $reset)
   ```json
   // Parent: { "tags": ["base", "service"] }
   // Child:  { "tags": ["production"] }
   // Result: { "tags": ["base", "service", "production"] }
   
   // With reset:
   // Child:  { "tags": { "$reset": true, "values": ["production"] } }
   // Result: { "tags": ["production"] }
   ```

**Merge Order**: Deterministic by directory order, then depth-first alphabetical for classes.

### Logging Conventions

Struktur uses structured logging with context preservation:

- **Quiet Mode** (`--quiet`): Suppresses progress logs, keeps errors
- **Phase Labels**: All errors include phase context (LOAD, MERGE, VALIDATE, RENDER)
- **File Paths**: Errors show absolute paths to source files
- **Instance Context**: When validation fails, shows instance ID and class
- **Stack Traces**: Available in non-quiet mode for debugging

**Error Message Structure**:
```
[VALIDATE] Schema constraint conflicts detected in class container:
  - TYPE_CONFLICT: domain_infrastructure/container
    Path: ports[*]
    Parent universal_base requires string
    Parent docked_container requires object
    No compatible types remain after merge
```

## Features

### Multi-Parent Inheritance

Classes inherit from multiple parents with deterministic merge order:

```json
{
  "class": "production_db",
  "parent": ["database", "production_config", "monitored_service"]
}
```

### Instance Merging

Multiple JSON files defining the same instance ID are merged:

```json
// base/config.json
{ "id": "app", "class": "service", "port": 8080 }

// prod/config.json  
{ "id": "app", "replicas": 5, "region": "us-east" }

// Result: { id: "app", class: "service", port: 8080, replicas: 5, region: "us-east" }
```

### Mixins

Composable stack extensions without modification:

```bash
struktur build examples/skribe \
  examples/skribe/mixins/rss \
  examples/skribe/mixins/dark-theme
```

### Multi-Pass Validation

Each class in the inheritance hierarchy validates independently:

```
universal_base → validates common fields
  ↓
docked_container → validates container-specific fields
```

## Template Helpers

### Built-in Helpers

- `eq`, `or` — Logic comparisons
- `concat` — Join strings
- `replace` — String replacement
- `sortBy` — Sort arrays by field
- `where`, `whereIncludes` — Filter arrays
- `groupBy` — Group by field
- `length` — Array/object length
- `render_file` — Generate separate output files

### Example Usage

```handlebars
{{#each (sortBy instances "name")}}
{{#if (eq class "container")}}
  {{render_file "layouts/container" (concat "containers/" id ".yml")}}
{{/if}}
{{/each}}
```

## Examples

### Docker Compose Generation

```bash
cd examples/docked
struktur build \
  -c classes/ \
  -a aspects/ \
  -i instances/ \
  -t templates/ \
  -b build/
  
# Output: build/docker-compose.yml with all containers configured
```

### Static Site Generation

```bash
cd examples/skribe
struktur build -c classes/ -i instances/ -t templates/ -b build/

# With RSS feed
struktur build . mixins/rss -b build/
```

### Infrastructure as Code

```bash
struktur build \
  -c infra/classes/ \
  -i infra/instances/ \
  -t terraform/ \
  -b output/
```

## Configuration

### Directory Exclusions

Struktur automatically excludes:
- `mixins/` directories (must be explicitly included)
- `stacks/` directories (must be explicitly included)
- `node_modules/`
- Build outputs containing `canonical.json`

### Template Engines

Supported engines:
- **Handlebars** (default) — `--engine handlebars`
- **Nunjucks** — `--engine nunjucks`

## Development

### Run Tests

```bash
npm test
```

### Local Development

```bash
npm link
struktur --version
```

## Documentation

- [API Reference](docs/)
- [Architecture](docs/archive/)
- [Examples](examples/)

## Use Cases

- **Infrastructure as Code** — Generate Terraform, CloudFormation, K8s manifests
- **Container Orchestration** — Build docker-compose files from structured data
- **Static Sites** — Type-safe content management with schema validation
- **Configuration Management** — Validate and generate service configs
- **Documentation** — Generate docs from structured specifications

## Why Struktur?

Traditional config management is error-prone:
- ❌ No type safety (typos cause runtime failures)
- ❌ No validation (invalid configs deploy to production)
- ❌ Duplication (copy-paste across environments)
- ❌ No composition (hard to share common patterns)

Struktur solves this:
- ✅ JSON Schema catches errors at build time
- ✅ Multi-parent inheritance eliminates duplication
- ✅ Deterministic builds (same input = same output)
- ✅ Composable mixins for reusable extensions
- ✅ Full auditability of what was merged and why

## Requirements

- Node.js ≥ 18.0.0

## License

Apache 2.0 — see [LICENSE](LICENSE)

## Support

- **Issues**: [GitHub Issues](https://github.com/nucleic-se/struktur/issues)
- **Email**: daddy@nucleic.se

## Status

**Version**: 0.2.0-alpha  
**Tests**: 364/364 passing ✅  
**Status**: Alpha (breaking changes allowed)

This is a clean rewrite with improved architecture. Breaking changes from 0.1.x are expected.
