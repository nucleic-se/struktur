# Configuration Files

Struktur uses configuration files to define stack builds. Config files are optional - you can use CLI flags for everything - but they make builds repeatable and self-documenting.

## File Naming

Any file ending in `.build.json` is recognized as a config file:
- `struktur.build.json` (default, recommended)
- `dev.build.json`, `prod.build.json` (environment-specific)
- `fast.build.json`, `full.build.json` (build variants)
- Whatever makes sense for your project!

## Location

Struktur automatically looks for any `*.build.json` file in:
1. The stack directory (if you run `struktur build my-stack/`)
2. The current working directory

**Preference:** If multiple `.build.json` files exist, struktur prefers `struktur.build.json`, otherwise uses the first found.

Specify an exact config file with `--config`:
```bash
struktur build --config prod.build.json
```

## Basic Structure

```json
{
  "classes": ["../universal/classes", "classes"],
  "aspects": ["aspects"],
  "instances": ["instances"],
  "templates": ["templates"],
  "build_dir": "build"
}
```

All paths are relative to the config file's location.

## Available Fields

### Required Fields

**None** - all fields are optional. You can mix config file settings with CLI flags.

### Stack Source Directories

- **`classes`** - Array of directories containing class schema files
- **`aspects`** - Array of directories containing aspect schema files  
- **`instances`** - Array of directories containing instance JSON files
- **`templates`** - Array of directories containing template files

These are merged in order (last wins for conflicts).

### Build Configuration

- **`build_dir`** - Output directory for build artifacts (default: `"build"`)
- **`template_engine`** - Template engine to use: `"handlebars"` or `"nunjucks"` (default: `"handlebars"`)
- **`render`** - Array of templates to render (required for template output)

#### Render Array Format

The `render` field specifies which templates to render and where to output them:

```json
{
  "render": [
    { "template": "nginx.conf.hbs", "output": "/nginx.conf" },
    { "template": "docker-compose.yml.hbs", "output": "/docker-compose.yml" },
    { "template": "README.md.hbs", "output": "/README.md" }
  ]
}
```

Each entry requires:
- **`template`** - Template file name (with extension)
- **`output`** - Output path (relative to `build_dir`)

**Instance render arrays:** Instances can also have `$render` arrays. Config render tasks execute first, then instance render tasks (alphabetically). See [Render Arrays in concepts-instances.md](concepts-instances.md#render-arrays) for details.

### Validation Options

- **`exact`** - Use exact build directory without hash suffix (default: `false`)
- **`warn_extra_fields`** - Warn about instance fields not in schemas (default: `true`)
- **`warnings_as_errors`** - Treat validation warnings as errors (default: `true`)

**Default behavior:** When `exact` is `false`, builds output to hash-based directories (deterministic by default).

### Template Options

- **`allow_template_collisions`** - Allow duplicate template names across directories, last wins (default: `false`)

### Output Options

- **`quiet`** - Suppress output except errors (default: `false`)

## Complete Example

```json
{
  "classes": ["../universal/classes", "classes"],
  "aspects": ["../universal/aspects", "aspects"],
  "instances": ["../universal/instances", "instances"],
  "templates": ["../universal/templates", "templates"],
  "build_dir": "build",  // Outputs to build/build-<hash>/ by default
  "template_engine": "handlebars",
  "render": [
    { "template": "index.html.hbs", "output": "/index.html" },
    { "template": "api/docs.html.hbs", "output": "/api/docs.html" },
    { "template": "config/nginx.conf.hbs", "output": "/nginx.conf" }
  ],
  "warn_extra_fields": true,
  "warnings_as_errors": true,
  "allow_template_collisions": false,
  "quiet": false
}
```

## Template-Only Projects

You can build template outputs without any instances:

```json
{
  "templates": ["templates"],
  "build_dir": "build",
  "template_engine": "handlebars",
  "render": [
    { "template": "site.html.hbs", "output": "/index.html" },
    { "template": "about.html.hbs", "output": "/about.html" }
  ]
}
```

No `classes`, `aspects`, or `instances` needed - just templates and the `render` array.

## Naming Convention

All config fields use **snake_case** to match schema conventions:
- Config files: `build_dir`, `template_engine`
- Schema files: `parent_lineage`, `ssl_enabled`
- CLI flags: `--build-dir`, `--template-engine` (kebab-case)

This creates a clear separation: data layer (snake_case) vs CLI interface (kebab-case).

## Precedence Rules

Settings are applied in this order (last wins):

1. **Built-in defaults** - Conservative defaults for safety
2. **Config file** - Project-specific settings
3. **CLI flags** - One-off overrides for specific builds

Example:
```bash
# Uses template_engine from config (if set), otherwise 'handlebars'
struktur build

# CLI flag overrides config file
struktur build --template-engine nunjucks
```

## CLI Flag Mapping

| Config Field | CLI Flag | Default |
|-------------|----------|---------|
| `build_dir` | `--build-dir` | `"build"` |
| `template_engine` | `--engine` | `"handlebars"` |
| `render` | *(config only)* | `[]` |
| `exact` | `--exact` | `false` (hash-based build dirs) |
| `warn_extra_fields` | `--warn-extra-fields` | `true` |
| `warnings_as_errors` | `--warnings-as-errors` | `true` |
| `allow_template_collisions` | `--allow-template-collisions` | `false` |
| `quiet` | `--quiet` | `false` |

**Note:** The `render` field is config-only - there's no CLI equivalent. This makes configs the single source of truth for what gets rendered.

**Build directory behavior:** Hash-based build directories are the default. Use `--exact` to force exact paths or `--no-deterministic` to allow overwrites.

**Directory defaults vs explicit:** If you omit `classes`, `instances`, `aspects`, or `templates`, Struktur uses default directories (`./classes`, `./instances`, `./aspects`, `./templates`). Missing default directories are skipped silently, so you don't need to create empty folders. If you explicitly set a directory path (via config or CLI), it must exist or the build fails.

## Generating Configs from CLI

Instead of writing configs manually, generate them from successful builds:

```bash
# Experiment with CLI flags
struktur build my-stack/ --engine nunjucks --exact --build-dir dist

# Works! Save it as a config
struktur build my-stack/ --engine nunjucks --exact --build-dir dist --save-config prod.build.json

# Now use the config
struktur build --config prod.build.json
```

The `--save-config` flag:
- Saves only non-default values (minimal config)
- Uses relative paths (portable)
- Preserves `render` tasks from loaded config
- Writes config after successful build only

**Workflow:**
1. Experiment with CLI → find what works
2. Save with `--save-config` → capture settings
3. Tweak config → adjust as needed
4. Use with `--config` → repeatable builds

## Multiple Configs

You can have multiple configs for different build profiles:

```bash
# Name configs by purpose or environment
dev.build.json          # Fast iteration
prod.build.json         # Production settings
test.build.json         # CI/testing
handlebars.build.json   # Handlebars build
nunjucks.build.json     # Nunjucks build

# Struktur auto-detects any *.build.json
struktur build                        # Uses first *.build.json found

# Or specify explicitly
struktur build --config prod.build.json
```

## Best Practices

1. **Commit config files** - Makes builds reproducible
2. **Use relative paths** - Keeps configs portable
3. **Name configs clearly** - Purpose over format (e.g., `fast.build.json` not `config1.json`)
4. **Generate from CLI** - Use `--save-config` to avoid typos
5. **Keep configs minimal** - Only include non-default values

## Migration from Old Format

If you have configs with `buildDir` (camelCase), update to `build_dir` (snake_case):

```bash
# Quick find and replace
sed -i '' 's/"buildDir"/"build_dir"/g' struktur*.json
```

No backward compatibility - clean break for cleaner codebase.
