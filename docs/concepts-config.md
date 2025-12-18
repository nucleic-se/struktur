# Configuration Files

Struktur uses `struktur.build.json` configuration files to define stack builds. Config files are optional - you can use CLI flags for everything - but they make builds repeatable and self-documenting.

## Location

By default, struktur looks for `struktur.build.json` in:
1. The stack directory (if you run `struktur build my-stack/`)
2. The current working directory

You can specify a different config file with `--config`:
```bash
struktur build --config my-custom-config.json
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
    { "nginx.conf.hbs": "/nginx.conf" },
    { "docker-compose.yml.hbs": "/docker-compose.yml" },
    { "README.md.hbs": "/README.md" }
  ]
}
```

Each entry maps a template file to an output path (relative to `build_dir`).

### Validation Options

- **`exact`** - Deterministic mode: exact reproducible builds, sorted output (default: `false`)
- **`warn_extra_fields`** - Warn about instance fields not in schemas (default: `true`)
- **`warnings_as_errors`** - Treat validation warnings as errors (default: `true`)

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
  "build_dir": "build",
  "template_engine": "handlebars",
  "render": [
    { "index.html.hbs": "/index.html" },
    { "api/docs.html.hbs": "/api/docs.html" },
    { "config/nginx.conf.hbs": "/nginx.conf" }
  ],
  "exact": true,
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
    { "site.html.hbs": "/index.html" },
    { "about.html.hbs": "/about.html" }
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
| `exact` | `--exact` | `false` |
| `warn_extra_fields` | `--warn-extra-fields` | `true` |
| `warnings_as_errors` | `--warnings-as-errors` | `true` |
| `allow_template_collisions` | `--allow-template-collisions` | `false` |
| `quiet` | `--quiet` | `false` |

**Note:** The `render` field is config-only - there's no CLI equivalent. This makes configs the single source of truth for what gets rendered.

## Multiple Configs

You can have multiple configs for different build profiles:

```bash
# Production build with Handlebars
struktur build --config struktur.build.json

# Development build with Nunjucks  
struktur build --config struktur.nunjucks.build.json

# CI build with strict validation
struktur build --config struktur.ci.build.json
```

## Best Practices

1. **Commit config files** - Makes builds reproducible across team
2. **Use relative paths** - Keeps configs portable
3. **Name configs clearly** - `struktur.production.build.json`, `struktur.dev.build.json`
4. **Document differences** - Add comments (JSON5) or README explaining multiple configs
5. **Keep configs simple** - Override with CLI flags for one-off experiments

## Migration from Old Format

If you have configs with `buildDir` (camelCase), update to `build_dir` (snake_case):

```bash
# Quick find and replace
sed -i '' 's/"buildDir"/"build_dir"/g' struktur*.json
```

No backward compatibility - clean break for cleaner codebase.
