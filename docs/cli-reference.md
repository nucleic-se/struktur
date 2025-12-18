# CLI Reference

Complete reference for all Struktur commands, flags, and configuration.

## Commands

### `validate`

Validate instances against schemas without generating output.

```bash
struktur validate [options] [stack-dirs...]
```

**Arguments:**
- `stack-dirs` - One or more directories to validate. Auto-discovers `classes/`, `instances/`, `aspects/` subdirectories

**Options:**
- `-c, --classes <dirs...>` - Class definition directories (can specify multiple)
- `-a, --aspects <dirs...>` - Aspect definition directories (can specify multiple)
- `-i, --instances <dirs...>` - Instance file directories (can specify multiple)
- `-q, --quiet` - Suppress output except errors
- `--json` - Output validation results as JSON
- `-h, --help` - Show command help

**Examples:**

```bash
# Validate using stack directory auto-discovery
struktur validate mystack

# Explicit paths
struktur validate -c classes/ -i instances/

# Multiple stack directories (merged left-to-right)
struktur validate universal mystack

# JSON output for scripting
struktur validate mystack --json > validation-results.json

# Quiet mode (exit code indicates success/failure)
struktur validate mystack --quiet
```

**Behavior:**
- Loads classes and schemas from `-c/--classes` directories
- Loads aspect definitions from `-a/--aspects` directories  
- Loads instances from `-i/--instances` directories
- Validates each instance against its class schema
- Validates required aspects are present
- Reports all validation errors with context
- Exits with code 0 on success, 1 on validation failures

**Path Resolution:**
- Stack dir paths: Relative to current working directory
- Autodiscovery: Looks for `classes/`, `instances/`, `aspects/` under each stack dir

---

### `build`

Build complete outputs with template rendering. Validation is always enabled with strict checks (extra fields and warnings treated as errors).

```bash
struktur build [options] [stack-dirs...]
```

**Arguments:**
- `stack-dirs` - One or more directories to build. Auto-discovers `classes/`, `instances/`, `aspects/`, `templates/` subdirectories

**Options:**
- `-c, --classes <dirs...>` - Class definition directories
- `-a, --aspects <dirs...>` - Aspect definition directories
- `-i, --instances <dirs...>` - Instance file directories  
- `-t, --templates <dirs...>` - Template directories to render
- `-b, --build-dir <dir>` - Build output directory (default: `./build`)
- `--config <file>` - Path to build config file (auto-discovers `*.build.json`)
- `--save-config <file>` - Save successful build settings to config file
- `--engine <name>` - Template engine: `handlebars` or `nunjucks` (default: `handlebars`)
- `-q, --quiet` - Suppress output except errors
- `--json` - Output build results as JSON
- `--exact` - Use exact build directory path without hash suffix (recommended)
- `--no-deterministic` - Disable deterministic build directories (allows overwrites)
- `--allow-template-collisions` - Allow templates with same name in multiple directories (last wins)
- `-h, --help` - Show command help

**Examples:**

```bash
# Build using stack directory (finds struktur.build.json if present)
struktur build mystack

# Build with explicit paths
struktur build -c classes/ -i instances/ -t templates/ -b output/

# Build from config file
struktur build --config mystack/struktur.build.json

# Layer multiple stacks (universal + mystack)
struktur build universal mystack

# Use Nunjucks instead of Handlebars
struktur build mystack --engine nunjucks

# Allow template name conflicts (last directory wins)
struktur build base overlay --allow-template-collisions

# Use exact build directory (recommended for tutorials and production)
struktur build mystack --exact

# Non-deterministic build (overwrites previous build)
struktur build mystack --no-deterministic
```

**Behavior:**
- **Phase 1 (LOAD)**: Discovers and loads classes, aspects, instances from directories
- **Phase 2 (MERGE)**: Combines instances with class defaults, applies inheritance
- **Phase 3 (VALIDATE)**: Validates merged data against schemas
- **Phase 4 (RENDER)**: Executes templates with validated data, writes outputs

**Build Output:**
- By default: `./build/build-<hash>/` (deterministic, based on input hash)
- With `--exact`: `./build/` (uses exact path, simpler for tutorials/production)
- With `--no-deterministic`: `./build/` (overwrites previous, with collision warnings)
- Custom: Specify with `-b/--build-dir`

**Build Directory Structure:**
```
build/build-88b76788/     # Hash-based directory
├── canonical.json        # Merged, validated data
├── meta/                 # Metadata outputs
│   ├── classes.json
│   └── validation.json
└── <rendered files>      # Template outputs (depend on templates)
```

**Config File Auto-Discovery:**
When you run `struktur build mystack`:
1. Searches for any `*.build.json` file in `mystack/`
2. Prefers `struktur.build.json` if multiple files exist
3. If found, loads config and resolves paths relative to config file directory
4. CLI flags override config file values
5. Fallback: Uses `struktur.build.json` in current directory if not found in stack dir

---

### `generate`

Generate canonical JSON output without rendering templates.

```bash
struktur generate [options] [stack-dirs...]
```

**Arguments:**
- `stack-dirs` - One or more directories. Auto-discovers `classes/`, `instances/`, `aspects/` subdirectories

**Options:**
- `-c, --classes <dirs...>` - Class definition directories
- `-a, --aspects <dirs...>` - Aspect definition directories
- `-i, --instances <dirs...>` - Instance file directories
- `-t, --templates <dirs...>` - Template directories to render
- `-o, --output <file>` - Output file path (default: stdout)
- `--engine <name>` - Template engine: `handlebars` or `nunjucks` (default: `handlebars`)
- `--no-metadata` - Exclude metadata from output
- `--no-class-index` - Exclude class index from output
- `--include-validation` - Include validation results in output
- `--json` - Output results as JSON (includes canonical + stats)
- `-h, --help` - Show command help

**Examples:**

```bash
# Generate canonical.json
struktur generate mystack

# Custom output path
struktur generate mystack -o build/data.json

# Merge multiple stacks
struktur generate universal mystack -o merged.json

# Explicit directories
struktur generate -c classes/ -i instances/ -o canonical.json
```

**Behavior:**
- Loads and merges data like `build` command
- Validates instances against schemas
- Writes canonical JSON output
- **Does not** render templates (use `build` for that)

**Canonical Output Structure:**
```json
{
  "instances": [...],           // Array of all instances
  "instances_by_id": {...},     // Map of id -> instance
  "classes": [...],             // Array of class definitions
  "classes_by_id": {...},       // Map of class name -> resolved class
  "aspects": [...],             // Array of aspect definitions
  "aspects_by_id": {...},       // Map of aspect name -> definition
  "metadata": {
    "timestamp": "2025-12-16T...",
    "version": "0.2.3-alpha",
    "generator": "struktur",
    "count": 42
  }
}
```

---

### `info`

Display loaded classes and aspects.

```bash
struktur info [options]
```

**Options:**
- `-c, --classes <dirs...>` - Class definition directories
- `-a, --aspects <dirs...>` - Aspect definition directories
- `-q, --quiet` - Suppress output
- `--json` - Output as JSON
- `-h, --help` - Show command help

**Examples:**

```bash
# Show all classes
struktur info -c classes/

# Show classes and aspects
struktur info -c classes/ -a aspects/

# JSON format for scripting
struktur info -c classes/ --json | jq '.classes[] | .class'
```

**Behavior:**
- Lists all discovered classes with inheritance chains
- Lists all discovered aspects with kinds
- Shows field definitions for each class
- Does not validate instances (use `validate` for that)

---

### `init`

Initialize new stack from example.

```bash
struktur init [options] [directory]
```

**Arguments:**
- `directory` - Target directory to create (defaults to example name)

**Options:**
- `--example <name>` - Example to copy: `universal`, `docked`, or `skribe`
- `--force` - Overwrite existing directory
- `-h, --help` - Show command help

**Examples:**

```bash
# Initialize Universal base (default)
struktur init universal

# Initialize with custom directory name (uses universal by default)
struktur init my-project

# Initialize Docked example
struktur init --example docked my-stack

# Overwrite existing directory
struktur init --example skribe my-site --force
```

**Available Examples:**
- **universal** - Base classes (entity_base, aspect_base, domain_root) and viewer
- **docked** - Docker container stack extending Universal
- **skribe** - Static site generator with blog posts and pages

---

## Configuration File

### Build Config File

Optional configuration file for build settings. Automatically discovered when building a directory.

**Naming:**
- Auto-discovers any `*.build.json` file in stack directory
- Prefers `struktur.build.json` if multiple exist
- Or specify explicitly with `--config <file>`

**Examples:**
- `struktur.build.json` (standard name)
- `my-stack.build.json` (custom name, auto-discovered)
- `dev.build.json`, `prod.build.json` (environment-specific)

**Schema:**

```json
{
  "classes": ["./classes", "../universal/classes"],
  "aspects": ["./aspects"],
  "instances": ["./instances"],
  "templates": ["./templates"],
  "build_dir": "./build",
  "template_engine": "handlebars",
  "exact": true,
  "allow_template_collisions": false,
  "warn_extra_fields": true,
  "warnings_as_errors": true,
  "quiet": false
}
```

**Fields:**
- `classes` (string | string[]) - Class directories (relative to config file)
- `aspects` (string | string[]) - Aspect directories (relative to config file)
- `instances` (string | string[]) - Instance directories (relative to config file)
- `templates` (string | string[]) - Template directories (relative to config file)
- `build_dir` (string) - Build output directory (relative to config file)
- `template_engine` (string) - Template engine: `handlebars` or `nunjucks` (default: `handlebars`)
- `exact` (boolean) - Use exact build directory without hash suffix (default: false)
- `allow_template_collisions` (boolean) - Allow template name conflicts (default: false)
- `warn_extra_fields` (boolean) - Warn about fields not in schema (default: true)
- `warnings_as_errors` (boolean) - Treat warnings as errors (default: true)
- `quiet` (boolean) - Suppress non-error output (default: false)

**Note:** All field names use `snake_case` for consistency with CLI flags.

**Path Resolution:**
- **In config file**: Paths are relative to the config file's directory
- **CLI arguments**: Paths are relative to current working directory
- **Precedence**: CLI flags override config file values

**Example Usage:**

```bash
# Config file at mystack/my-stack.build.json (auto-discovered)
{
  "classes": ["../universal/classes", "./classes"],
  "instances": ["./instances"],
  "templates": ["./templates"],
  "build_dir": "./build",
  "exact": true
}

# Build uses paths relative to mystack/
struktur build mystack

# Override template dir
struktur build mystack -t other-templates/

# Save current CLI flags to config file
struktur build mystack --exact --save-config mystack/struktur.build.json
```

**--save-config Flag:**
- Captures successful build settings and saves to config file
- Includes all directories used (classes, aspects, instances, templates)
- Saves paths relative to config file directory (portable across machines)
- Only saves non-default values (keeps config minimal)
- Example: `struktur build -c classes/ -i instances/ --exact --save-config my.build.json`

---

## Flag Details

### Validation Flags

**`--quiet` / `-q`**
- Suppresses all output except errors
- Useful for CI/CD scripts
- Exit code still indicates success (0) or failure (1)

**`--json`**
- Outputs results as JSON instead of human-readable format
- Structure varies by command (validation results, build metadata, etc.)
- Combine with `--quiet` to get only JSON output

### Build Flags

**`--exact`** (Recommended)
- Uses exact build directory path without hash suffix
- Builds into `./build/` instead of `./build/build-<hash>/`
- Overrides `--deterministic` setting
- Recommended for tutorials, production builds, and predictable paths
- Example: `struktur build mystack --exact` → `./build/`

**`--no-deterministic`**
- Disables hash-based build directories
- Builds directly into `--build-dir` path (overwrites previous builds)
- Default behavior: `build/build-<hash>/` for deterministic builds
- Use when you want predictable output paths

**`--allow-template-collisions`**
- Permits templates with the same name in multiple directories
- Last directory in the list wins
- Default behavior: Fails on template name collisions
- Use for intentional template overriding (e.g., base + theme)

**`--engine <name>`**
- Switches template engine: `handlebars` or `nunjucks`
- Default: `handlebars`
- Affects helper availability and template syntax

**`--config <file>`**
- Explicitly specifies config file path
- Without this, auto-discovers `struktur.build.json` in stack directory
- Path can be absolute or relative to CWD

### Directory Flags

**`-c, --classes <dirs...>`**
- Specifies class definition directories
- Can repeat flag for multiple directories: `-c dir1 -c dir2`
- Or space-separate: `-c dir1 dir2 dir3`
- Loaded in order (later directories can override earlier ones)

**`-a, --aspects <dirs...>`**
- Specifies aspect definition directories
- Multiple directories supported like `--classes`

**`-i, --instances <dirs...>`**
- Specifies instance file directories
- Multiple directories supported
- Instances with same `id` are merged (later overrides earlier)

**`-t, --templates <dirs...>`**
- Specifies template directories
- Multiple directories supported
- Template collision detection applies (fails by default, unless `--allow-template-collisions`)

**`-b, --build-dir <dir>`**
- Sets build output directory
- Default: `./build`
- Combined with deterministic mode: `<build-dir>/build-<hash>/`
- Combined with `--no-deterministic`: `<build-dir>/`

---

## Exit Codes

All commands use standard exit codes:

- **0** - Success (validation passed, build succeeded)
- **1** - Failure (validation errors, build errors, missing files)

Use in scripts:

```bash
if struktur validate mystack --quiet; then
  echo "Validation passed"
  struktur build mystack
else
  echo "Validation failed" >&2
  exit 1
fi
```

---

## Common Patterns

### Multi-Stack Composition

Layer multiple stacks (earlier directories provide base, later override):

```bash
struktur build universal company mystack
```

Equivalent explicit form:

```bash
struktur build \
  -c universal/classes company/classes mystack/classes \
  -a universal/aspects company/aspects mystack/aspects \
  -i universal/instances company/instances mystack/instances \
  -t universal/templates company/templates mystack/templates
```

### CI/CD Integration

```bash
# Validate before merge
struktur validate mystack --quiet --json > validation.json
if [ $? -ne 0 ]; then
  echo "Validation failed"
  cat validation.json
  exit 1
fi

# Build for deployment
struktur build mystack --quiet --no-deterministic -b dist/
```

### Development Workflow

```bash
# Quick validate during development
struktur validate mystack

# Build with specific engine
struktur build mystack --engine nunjucks

# Generate canonical for inspection
struktur generate mystack -o debug.json
```

---

## See Also

- [Helper Reference](helpers-reference.md) - Template helper functions
- [Concepts: Build Pipeline](concepts-build-pipeline.md) - Four-phase build process
- [Errors & Troubleshooting](errors-troubleshooting.md) - Common issues
