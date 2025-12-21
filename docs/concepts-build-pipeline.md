# Concepts: Build Pipeline

Understanding Struktur's four-phase build process.

## Overview

Struktur builds execute through four independent, sequential phases. Each phase has a specific responsibility and can fail independently with clear error context.

```
1. LOAD      → Discover and load files
2. MERGE     → Combine data with inheritance
3. VALIDATE  → Check schemas and constraints
4. RENDER    → Execute templates to outputs
```

**Key principle:** Fail fast—errors in early phases prevent later phases from running.

---

## Phase 1: LOAD

### Responsibility

Discover and load data files from directories.

### Process

1. **Scan directories** for files
2. **Load class definitions** (`.json` files)
3. **Load schemas** (`.class.json` files)
4. **Load aspects** (aspect definitions)
5. **Load instances** (instance data files)
6. **Load templates** (`.hbs`, `.njk` files)

### Directory Auto-Discovery

When you run `struktur build mystack`:

```
mystack/
├── classes/     ← Auto-discovered
├── aspects/     ← Auto-discovered
├── instances/   ← Auto-discovered
└── templates/   ← Auto-discovered
```

### Explicit Paths

Or specify explicitly:

```bash
struktur build \
  -c universal/classes mystack/classes \
  -a universal/aspects mystack/aspects \
  -i instances/base instances/prod \
  -t templates/
```

### Load Order

**Classes:** Loaded in directory order, then alphabetically
**Instances:** Loaded in directory order, then alphabetically
**Templates:** Loaded from all specified directories

### Output

```
Build Phase: Stack Loading & Validation
✓ Loaded 15 classes (10 from universal, 5 local)
✓ Loaded 3 aspects
✓ Loaded 42 instances
✓ Template directories: 2
```

### Errors in LOAD Phase

**Missing directory:**
```
[LOAD] Error: Cannot find classes directory: ../universal/classes
Path: /Users/you/project/../universal/classes
```

**Invalid JSON:**
```
[LOAD] Error parsing instance file
File: instances/web-01.json
Line 5: Unexpected token } in JSON
```

**Missing required files:**
```
[LOAD] Error: Class "server" has schema but no class definition
Expected: classes/server.json
```

---

## Phase 2: MERGE

### Responsibility

Combine data from multiple sources into complete instances.

### Process

1. **Resolve class inheritance** (build lineage)
2. **Accumulate $uses_aspects and $aspect_defaults** (parent → child)
3. **Merge class defaults** (parent → child)
4. **Merge multi-file instances** (same ID)
5. **Apply three-layer aspect merge** (aspect.defaults → class.$aspect_defaults → instance.$aspects)
6. **Build canonical structure**

### Merge Order

For each instance:

```
1. Root parent class defaults
2. Parent class defaults (if multiple parents: left-to-right)
3. Child class defaults
4. First instance file with this ID
5. Second instance file with this ID
6. ... (all instance files, in directory/alphabetical order)
7. Last instance file with this ID

Later sources override earlier sources
```

**For aspect data specifically:**
```
1. Aspect definition defaults      (from aspect file)
2. Parent class $aspect_defaults    (accumulated through inheritance)
3. Child class $aspect_defaults     (deep merged with parents)
4. Instance aspects                (highest priority)

Each layer deep merges with previous, instance always wins
```

### Example Merge

**Classes:**
```json
// entity_base.json
{
  "$class": "entity_base",
  "$fields": {
    "name": "",
    "labels": []
  }
}

// server.json
{
  "$class": "server",
  "$parent": "entity_base",
  "$fields": {
    "replicas": 1
  }
}
```

**Instances:**
```json
// base/web-01.json
{
  "$id": "web-01",
  "$class": "server",
  "name": "Web Server 01",
  "hostname": "web-01.local"
}

// prod/web-01.json
{
  "$id": "web-01",
  "replicas": 3,
  "labels": ["production"]
}
```

**Merged Result:**
```json
{
  "$id": "web-01",
  "$class": "server",
  "name": "Web Server 01",        // From base/web-01.json
  "hostname": "web-01.local",     // From base/web-01.json
  "replicas": 3,                  // From prod/web-01.json (overrides class default)
  "labels": ["production"]        // From prod/web-01.json (appended to class default)
}
```

### Array Merging

**Default:** Arrays append
```
Class:    ["base", "service"]
Instance: ["production"]
Result:   ["base", "service", "production"]
```

**With $reset:** Arrays replace
```
Instance: { "labels": { "$reset": true, "values": ["production"] } }
Result:   ["production"]
```

### Output

```
Build Phase: Data Merging
✓ Resolved 15 class lineages
✓ Merged 42 instances
✓ Applied 12 aspect compositions
```

### Errors in MERGE Phase

**Circular inheritance:**
```
[MERGE] Error: Circular inheritance detected
Class "A" inherits from "B" which inherits from "A"
```

**Unknown parent:**
```
[MERGE] Error: Class "web_server" references unknown parent "server"
Available classes: entity_base, service, database
```

**Unknown class in instance:**
```
[MERGE] Error: Instance "my-app" references unknown class "application"
File: instances/my-app.json
```

---

## Phase 3: VALIDATE

### Responsibility

Ensure merged data satisfies schemas and constraints.

### Process

1. **Structural validation** (JSON Schema per class)
2. **Constraint validation** (bounds, enums, patterns)
3. **Semantic validation** (formats, data quality)
4. **Aspect validation** (aspect data against aspect schemas)
5. **Canonical validation** (output structure integrity)

### Multi-Pass Validation

Each class in inheritance chain validates independently:

```
Instance: { "$id": "web-01", "$class": "web_server", ... }

Validates against:
1. entity_base.class.json
2. server.class.json
3. web_server.class.json
```

**All must pass.**

### Validation Strictness

**Default (strict):**
- Schema warnings → errors
- Extra fields → warnings
- Constraint conflicts → always errors

**Modes:**
- `--warnings-as-errors` (default: true)
- `--warn-extra-fields` (default: true)

### Output

```
Build Phase: Validation
✓ Validated 42 instances
✓ All schemas passed
✓ No constraint violations
```

### Errors in VALIDATE Phase

**Missing required field:**
```
[VALIDATE] Validation Error (instance: web-01)
  Property "hostname" is required but not provided
  Schema: server.class.json
  Class: web_server (inherits: entity_base → server → web_server)
```

**Type mismatch:**
```
[VALIDATE] Validation Error (instance: app)
  Property "port" expected type "integer" but got "string"
  Value: "8080"
  Schema: service.class.json
```

**Constraint violation:**
```
[VALIDATE] Validation Error (instance: db)
  Property "replicas" value -1 violates minimum constraint (1)
  Schema: database.class.json
```

**Extra field warning (promoted to error):**
```
[VALIDATE] Warning treated as error (--warnings-as-errors=true)
  Instance "app" has extra property "subtitle"
  Class "service" schema does not define this property
```

---

## Phase 4: RENDER

### Responsibility

Execute templates with validated data to generate outputs.

### Process

1. **Initialize template engine** (Handlebars or Nunjucks)
2. **Register helpers** (generic, Struktur-specific, engine helpers)
3. **Load templates** from directories
4. **Execute each template** with canonical context
5. **Write outputs** to build directory
6. **Write canonical.json** (the validated data model)

### Template Context

Every template receives:

```javascript
{
  $instances: [...],
  $instances_by_id: {...},
  $classes: [...],
  $classes_by_id: {...},
  $class_names: [...],
  $aspects: [...],
  $aspects_by_id: {...},
  $aspect_names: [...],
  $metadata: {
    timestamp: "2025-12-16T10:30:00Z",
    version: "0.2.3-alpha",
    generator: "struktur"
  },
  canonical: { ... }
}
```

### Render Order

1. **Main templates** (one output per template file)
2. **render_file templates** (multiple outputs via helper)
3. **Canonical JSON** (always written)

### Output

```
Build Phase: Template Loading
✓ Loaded 5 templates

Build Phase: Rendering
✓ Rendered index.html
✓ Rendered posts/welcome.html (via render_file)
✓ Rendered posts/intro.html (via render_file)
✓ Rendered about.html
✓ Wrote canonical.json

Build Phase: Finalization
✓ Build complete: build/build-a3f7c812/

Build Output:
  build/build-a3f7c812/
  ├── canonical.json
  ├── index.html
  ├── about.html
  └── posts/
      ├── welcome.html
      └── intro.html
```

### Errors in RENDER Phase

**Template not found:**
```
[RENDER] Error: Template not found: post.html.hbs
Template directories searched:
  - templates/
```

**Undefined variable:**
```
[RENDER] Error rendering template: index.html.hbs
Line 10: ReferenceError: author is not defined
```

**render_file error:**
```
[RENDER] Error in render_file helper
Template: detail.html.hbs
Output: posts/undefined.html
Issue: Cannot create file with undefined in path
```

**Path safety violation:**
```
[RENDER] Error: Output path outside build directory
Attempted: ../../../etc/passwd
Blocked for security
```

---

## Build Output Structure

### Default (Deterministic)

```
build/
└── build-a3f7c812/    ← Hash-based directory
    ├── canonical.json
    ├── index.html
    └── posts/
        └── welcome.html
```

**Hash based on:** Input files, class definitions, instance data

**Benefits:**
- Multiple builds coexist
- No overwrites
- Auditable history

### Non-Deterministic

```bash
struktur build . --no-deterministic -b output/
```

**Output:**
```
output/
├── canonical.json
├── index.html
└── posts/
    └── welcome.html
```

**Use when:** You want predictable output path

---

## Phase Dependencies

### Sequential Execution

Phases run in strict order:

```
LOAD → MERGE → VALIDATE → RENDER
 ↓      ↓         ↓          ↓
Fail   Fail      Fail       Fail
 ↓      ↓         ↓          ↓
Stop   Stop      Stop       Complete
```

**If any phase fails, build stops immediately.**

### Phase Independence

Each phase is self-contained:

- **LOAD** doesn't know about validation
- **MERGE** doesn't know about rendering
- **VALIDATE** doesn't modify data
- **RENDER** doesn't re-validate

**Benefits:**
- Clear error attribution
- Easier debugging
- Modular architecture

---

## Error Handling

### Error Context

All errors include:

1. **Phase label:** `[LOAD]`, `[MERGE]`, `[VALIDATE]`, `[RENDER]`
2. **File path:** Absolute path to source file
3. **Instance/class context:** What was being processed
4. **Specific issue:** What went wrong
5. **Suggested fix:** How to resolve (when possible)

### Example Error Messages

**LOAD:**
```
[LOAD] Error: Cannot find classes directory: ../universal/classes
Path: /Users/you/project/../universal/classes

Fix: Ensure path is correct relative to current directory
```

**MERGE:**
```
[MERGE] Error: Circular inheritance detected
Class: "post" → "content" → "post"
File: classes/post.json

Fix: Remove circular parent reference
```

**VALIDATE:**
```
[VALIDATE] Validation Error (instance: web-01)
  Property "port" is required but not provided
  Schema: server.class.json
  File: instances/web-01.json

Fix: Add "port" field to instance
```

**RENDER:**
```
[RENDER] Error rendering template: index.html.hbs
Line 15: Cannot read property 'name' of undefined
Context: {{post.author.name}}

Fix: Check that author exists or use {{default post.author.name "Anonymous"}}
```

---

## Logging Modes

### Normal Mode (Default)

Shows all phases and progress:

```
Build Phase: Stack Loading & Validation
✓ Loaded 15 classes
✓ Loaded 42 instances

Build Phase: Data Merging
✓ Resolved class lineages
✓ Merged instances

Build Phase: Validation
✓ All instances validated

Build Phase: Rendering
✓ Rendered 5 files

Build complete: build/build-abc123/
```

### Quiet Mode

Only shows errors:

```bash
struktur build . --quiet
```

**Output on success:** (none)
**Output on error:** Full error details
**Exit code:** 0 (success) or 1 (failure)

### JSON Mode

Machine-readable output:

```bash
struktur build . --json
```

**Output:**
```json
{
  "success": true,
  "buildDir": "build/build-abc123",
  "stats": {
    "classes": 15,
    "instances": 42,
    "outputs": 5
  },
  "duration_ms": 1234
}
```

---

## Build Determinism

### What Makes Builds Deterministic?

1. **Consistent merge order** (alphabetical, depth-first)
2. **Stable field order** (alphabetical keys)
3. **Reproducible timestamps** (unless explicitly randomized)
4. **No external state** (no network calls, no random values)

### Benefits

**Version Control:**
```bash
struktur build . -b dist/
git diff dist/canonical.json
# Empty diff = no changes
```

**CI/CD:**
```bash
# Build on dev
struktur build . --no-deterministic -b build-dev/

# Build on prod
struktur build . --no-deterministic -b build-prod/

# Compare
diff -r build-dev/ build-prod/
```

**Auditing:**
```bash
# Archive builds
struktur build . -b archive/2025-12-16/
# Later: inspect exactly what was built
```

---

## Best Practices

### 1. Validate Before Building

```bash
# Always validate first
struktur validate .
if [ $? -eq 0 ]; then
  struktur build .
fi
```

### 2. Inspect Canonical Between Changes

```bash
struktur generate . -o before.json
# Make changes
struktur generate . -o after.json
diff before.json after.json
```

### 3. Use Deterministic Builds for History

```bash
# Multiple builds coexist
struktur build .  # build/build-abc123/
# Make changes
struktur build .  # build/build-def456/

# Compare
diff build/build-abc123/canonical.json build/build-def456/canonical.json
```

### 4. Clean Build for Production

```bash
rm -rf build/
struktur build . --no-deterministic -b build/
```

---

## Troubleshooting

### Build Fails in LOAD

**Check:**
- Paths correct?
- Directories exist?
- JSON syntax valid?

**Debug:**
```bash
ls -la classes/ instances/ templates/
jq . classes/*.json
```

### Build Fails in MERGE

**Check:**
- Classes referenced exist?
- No circular inheritance?
- Parent names correct?

**Debug:**
```bash
struktur info -c classes/
grep -r '"parent"' classes/
```

### Build Fails in VALIDATE

**Check:**
- Required fields present?
- Types correct (no quoted numbers)?
- Constraints satisfied?

**Debug:**
```bash
struktur validate . --json | jq .
struktur generate . -o debug.json
jq '."$instances"[] | select(."$id" == "problematic-id")' debug.json
```

### Build Fails in RENDER

**Check:**
- Templates exist?
- Variables defined?
- Helpers correct?

**Debug:**
```bash
# Add to template
<pre>{{json this}}</pre>

# Rebuild and inspect
struktur build .
cat build/build-*/output.html
```

---

## See Also

- [Concepts: Validation](concepts-validation.md) - Validation phase details
- [Concepts: Templates](concepts-templates.md) - Render phase details
- [Concepts: Canonical](concepts-canonical.md) - Merge phase output
- [Errors & Troubleshooting](errors-troubleshooting.md) - Common issues
- [CLI Reference](cli-reference.md) - Build command options
