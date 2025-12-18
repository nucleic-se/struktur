# Template Engine Demo

This example demonstrates **Struktur's pluggable template engine support** by implementing the exact same stack using both **Handlebars** and **Nunjucks**.

## Design Philosophy

This stack is **opinionated and minimal**:

✅ **Side-by-side comparison** (same data, different engines)  
✅ **Minimal syntax examples** (not exhaustive reference)  
✅ **Production patterns** (escaping, conditionals, iteration)  
✅ **Clear tradeoffs** documented (when to use each engine)

**Not included:**
- Every template engine feature (use official docs for that)
- Complex template logic (keep templates simple)
- Engine-specific optimizations

**Use this as:**
- **Decision guide** (choosing between engines)
- **Syntax reference** (quick lookup for common patterns)
- **Migration template** (converting between engines)

**Don't expect:**
- Comprehensive engine documentation
- Performance benchmarks
- Advanced template patterns

## Overview

- **Same Data**: Both use identical `classes/`, `aspects/`, and instance files
- **Same Output**: Both produce equivalent `nginx.conf`, `docker-compose.yml`, and `README.md`
- **Different Syntax**: Shows engine-specific features and patterns
- **Proof Point**: Demonstrates template flexibility works as advertised

## Quick Start

### Build with Handlebars

```bash
../../cli.js build --exact
```

Uses `struktur.build.json` config (Handlebars is default).

### Build with Nunjucks

```bash
../../cli.js build --config struktur.nunjucks.build.json --engine nunjucks --exact
```

**Note**: Must include `--engine nunjucks` flag (config file setting not yet supported).

### Compare Outputs

```bash
diff build/handlebars/nginx.conf build/nunjucks/nginx.conf
diff build/handlebars/docker-compose.yml build/nunjucks/docker-compose.yml
```

Outputs are identical except for generator comment.

## Template Comparison

### Handlebars Syntax

**Iteration:**
```handlebars
{{#each (where instances "class" "web_service")}}
  server {
    listen {{aspects.web_service.port}};
    server_name {{aspects.web_service.hostname}};
  }
{{/each}}
```

**Conditionals:**
```handlebars
{{#if aspects.web_service.ssl_enabled}}
  ssl_certificate {{aspects.web_service.ssl_cert}};
{{/if}}
```

**Helpers:**
```handlebars
{{lowercase (replace name " " "-")}}
```

### Nunjucks Syntax

**Iteration:**
```nunjucks
{% for instance in instances %}
{% if instance.class == "web_service" %}
  server {
    listen {{ instance.aspects.web_service.port }};
    server_name {{ instance.aspects.web_service.hostname }};
  }
{% endif %}
{% endfor %}
```

**Conditionals:**
```nunjucks
{% if instance.aspects.web_service.ssl_enabled %}
  ssl_certificate {{ instance.aspects.web_service.ssl_cert }};
{% endif %}
```

**Filters:**
```nunjucks
{{ instance.name | lower | replace(" ", "-") }}
```

## When to Use Each

### Handlebars ✓

**Strengths:**
- Logic-less templates (enforced simplicity)
- Widely adopted (Ember.js, Ghost, Assemble)
- Familiar to JavaScript developers
- Custom helpers for complex logic

**Use when:**
- You want clear separation between logic and presentation
- Team prefers minimal template syntax
- You're migrating from Mustache

### Nunjucks ✓

**Strengths:**
- Powerful control structures (for, if, set, macro)
- Template inheritance (extends, blocks)
- Jinja2-like syntax (Python familiarity)
- Built-in filters and tests

**Use when:**
- You need complex control flow in templates
- Team familiar with Jinja2/Django templates
- You want template inheritance features

## Stack Structure

```
template-engine-demo/
├── README.md                          # This file
├── struktur.build.json                # Handlebars config
├── struktur.nunjucks.build.json       # Nunjucks config
├── classes/
│   └── web_service.schema.json        # Class definition
├── aspects/
│   └── web_service.schema.json        # Aspect schema
├── instances/                         # Shared instance data
│   ├── api_server.json                # Data only, no build arrays
│   └── web_app.json                   # Data only, no build arrays
├── build-tasks/                       # Engine-specific build orchestration
│   ├── handlebars/
│   │   └── build_handlebars.json      # References .hbs templates
│   └── nunjucks/
│       └── build_nunjucks.json        # References .njk templates
├── templates/
│   ├── handlebars/
│   │   ├── nginx.conf.hbs
│   │   ├── docker-compose.yml.hbs
│   │   └── README.md.hbs
│   └── nunjucks/
│       ├── nginx.conf.njk
│       ├── docker-compose.yml.njk
│       └── README.md.njk
└── build/                             # Build outputs (gitignored)
    ├── handlebars/                    # Handlebars output
    └── nunjucks/                      # Nunjucks output
```

## Key Differences

### Iteration

| Feature | Handlebars | Nunjucks |
|---------|-----------|----------|
| Context | `{{this}}` | `{{ item }}` |
| Filtering | `{{#each (where items ...)}}` | `{% for item in items if ... %}` |
| Index | `{{@index}}` | `{{ loop.index0 }}` |

### Conditionals

| Feature | Handlebars | Nunjucks |
|---------|-----------|----------|
| If | `{{#if condition}}` | `{% if condition %}` |
| Else | `{{else}}` | `{% else %}` |
| Comparison | `{{#if (eq a b)}}` | `{% if a == b %}` |

### String Manipulation

| Feature | Handlebars | Nunjucks |
|---------|-----------|----------|
| Lowercase | `{{lowercase text}}` | `{{ text \| lower }}` |
| Replace | `{{replace text " " "-"}}` | `{{ text \| replace(" ", "-") }}` |
| Chaining | Nested helpers | `{{ text \| lower \| replace(" ", "-") }}` |

## Migration Guide

### Handlebars → Nunjucks

1. **Change file extensions**: `.hbs` → `.njk`

2. **Update iteration**:
```handlebars
{{#each items}}{{this.name}}{{/each}}
```
→
```nunjucks
{% for item in items %}{{ item.name }}{% endfor %}
```

3. **Update conditionals**:
```handlebars
{{#if condition}}...{{/if}}
```
→
```nunjucks
{% if condition %}...{% endif %}
```

4. **Convert helpers to filters**:
```handlebars
{{lowercase (replace name " " "-")}}
```
→
```nunjucks
{{ name | replace(" ", "-") | lower }}
```

5. **Update build array**:
```json
{ "template.hbs": "/output" }
```
→
```json
{ "template.njk": "/output" }
```

6. **Add engine flag**:
```bash
struktur build --engine nunjucks
```

## Outputs Generated

Both engines produce identical outputs:

### nginx.conf
Nginx reverse proxy configuration for both services (API and Web App).

### docker-compose.yml
Docker Compose file with service definitions, ports, networks.

### README.md
Generated documentation listing all services and deployment instructions.

## Testing

### Manual Comparison

```bash
# Build both versions
../../cli.js build --exact
../../cli.js build --config struktur.nunjucks.build.json --engine nunjucks --exact

# Compare out/handlebars/ build/
diff -r build-handlebars/ build-nunjucks/ --exclude="canonical.json" --exclude=".struktur-manifest.json"
```

Should show only generator comment differences.

### Automated Tests

(TODO: Add equivalence tests in `/test` directory)

## Lessons Learned

### Config File Limitation

**Issue**: Config file `templateEngine` field is ignored. Must use `--engine` CLI flag.

**Workaround**: Always specify engine explicitly:
```bash
struktur build --config nunjucks.build.json --engine nunjucks
```

**See**: `private/docs/struktur_issues_2025-12-18.md` for details.

### Build Array Format

**Format**:
```json
{
  "build": [
    { "template.ext": "/output/path" }
  ]
}
```

**Not**:
```json
{
  "build": ["template.ext", "other.ext"]
}
```

### Shared Instance Data + Separate Build Tasks

**Best Practice**: Separate data from build orchestration.

- `instances/` - Shared data (api_server.json, web_app.json) - no build arrays
- `build-tasks/handlebars/` - Build orchestrator referencing .hbs templates
- `build-tasks/nunjucks/` - Build orchestrator referencing .njk templates

This avoids data duplication while allowing engine-specific template references.

## Further Reading

- [Handlebars Documentation](https://handlebarsjs.com/)
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [Struktur Template Concepts](../../docs/concepts-templates.md)
- [Struktur Helper Reference](../../docs/helpers-reference.md)
