# Concepts: Templates

Understanding template loading, rendering, validation, and error handling.

## Overview

Templates transform validated data into output files. Struktur uses template engines (Handlebars or Nunjucks) to render text-based outputs: HTML, YAML, JSON, shell scripts, configuration files, or any text format.

```
Validated Data + Template = Generated Output
```

**Key Features:**
- **Pre-flight validation** - All template errors found before rendering starts
- **Smart error messages** - File paths, line numbers, and helpful suggestions
- **Buffer system** - Named content buffers for layouts and multi-file output (see [Concepts: Template Buffers](concepts-template-buffers.md))
- **Flexible formats** - Both old and new task formats supported

---

## ⚠️ CRITICAL: HTML Escaping Rules

**TL;DR:** Use `{{{...}}}` (triple-stash) for environment variables, commands, and URLs. Use `{{...}}` (double-stash) for everything else.

### The Problem

Handlebars escapes HTML special characters by default, **which breaks configuration files:**

```handlebars
❌ WRONG - Gets HTML escaped
command: {{$aspects.docker_container.command}}
# Result: sh -c &#x27;npm install&#x27; (BROKEN!)

environment:
  DATABASE_URL: "{{database_url}}"
# Result: postgresql://user:pass@host:5432/db (= becomes &#x3D;)

✅ CORRECT - No escaping
command: {{{$aspects.docker_container.command}}}
# Result: sh -c 'npm install' (WORKS!)

environment:
  DATABASE_URL: "{{{database_url}}}"
# Result: postgresql://user:pass@host:5432/db (WORKS!)
```

### When to Use Triple-Stash `{{{...}}}`

**Always use triple-stash for:**
- ✅ Environment variable values (contain `=`, `:`, `@`, special chars)
- ✅ Command-line arguments (contain `=`, quotes, special chars)
- ✅ Shell commands (contain quotes, operators)
- ✅ URLs (contain `://`, `=`, `&`)
- ✅ Connection strings (contain `=`, `@`, `:`)
- ✅ Any value that could have `=`, `&`, `<`, `>`, `"`, `'`

### When to Use Double-Stash `{{...}}`

**Use double-stash for:**
- ✅ Simple identifiers (service names, IDs)
- ✅ Numbers (ports, counts)
- ✅ Booleans (true/false)
- ✅ Template control flow (`{{#if}}`, `{{#each}}`)

### Nunjucks Users

Use the `| safe` filter:
```nunjucks
environment:
  DATABASE_URL: {{ database_url | safe }}
```

**See [Template Best Practices](#best-practices) section below for complete guide.**

---

---

## Template Engines

### Handlebars (Default)

Logic-less templating with helpers:

```handlebars
<h1>{{title}}</h1>
{{#each posts}}
  <article>{{title}}</article>
{{/each}}
```

**Select with:**
```bash
struktur build . --engine handlebars
```

### Nunjucks (Optional)

Python Jinja2-inspired with filters:

```nunjucks
<h1>{{ title }}</h1>
{% for post in posts %}
  <article>{{ post.title }}</article>
{% endfor %}
```

**Select with:**
```bash
struktur build . --engine nunjucks
```

---

## Pre-Flight Validation

Struktur validates all templates **before** rendering begins, catching errors early:

### What's Validated

1. **Template Existence** - All templates referenced in config must exist
2. **File Resolution** - Templates are located in search paths
3. **Circular Extends** - Detects infinite template inheritance loops
4. **Smart Suggestions** - Missing extension? Wrong path? Struktur helps you fix it

### Error Messages

When validation fails, you get clear, actionable errors:

```
⚠️  Pre-flight validation found issues:

❌ Template not found: posts/article.njk

Searched in:
  /project/templates/posts/article.njk
  /project/common/posts/article.njk

💡 Suggestions:
  • Did you mean "posts/article.html.njk"? Add extension to build config
  • Verify build config render array matches actual files
  • Check template directory path in build config
```

### Benefits

- **Fail Fast** - All errors shown at once, no partial builds
- **Better DX** - Fix all issues before waiting for render
- **No Surprises** - Know if build will succeed before it starts

---

## Template Loading

### Discovery

Struktur automatically loads templates from specified directories:

```bash
struktur build -c classes/ -i instances/ -t templates/
```

**Files loaded:**
- `.hbs` - Handlebars templates
- `.handlebars` - Handlebars templates
- `.njk` - Nunjucks templates
- `.nunjucks` - Nunjucks templates
- **Any filename** - Templates can have any extension or none (engine determined by --engine flag)

**Note:** Template extensions are optional. You can use `posts.html` instead of `posts.html.hbs` - the engine is determined by the `--engine` flag, not the file extension.

### Directory Structure

```
templates/
├── index.html.hbs
├── posts/
│   ├── post.html.hbs
│   └── list.html.hbs
├── partials/
│   ├── header.hbs
│   └── footer.hbs
└── layouts/
    └── base.hbs
```

**Output mirrors structure:**
```
build/build-abc123/
├── index.html
└── posts/
    ├── post.html
    └── list.html
```

### Template Extensions

Output filename = template filename minus template extension:

```
index.html.hbs        → index.html
docker-compose.yml.hbs → docker-compose.yml
script.sh.hbs         → script.sh
config.json.hbs       → config.json
```

---

## Template Context

Every template receives the same context object:

### Context Structure

```javascript
{
  // Top-level convenience
  instances: [...],           // All instances (array)
  instances_by_id: {...},     // Instances by ID (object)
  classes: [...],             // All classes (array)
  classes_by_id: {...},       // Classes by name (object)
  aspects: [...],             // All aspects (array)
  aspects_by_id: {...},       // Aspects by name (object)
  
  // Build metadata
  buildContext: {
    timestamp: "2025-12-16T10:30:00Z",
    version: "0.2.3-alpha",
    generator: "struktur"
  },
  
  // Full canonical structure
  canonical: {
    instances: [...],
    instances_by_id: {...},
    classes: [...],
    classes_by_id: {...},
    aspects: [...],
    aspects_by_id: {...},
    metadata: {...}
  }
}
```

### Accessing Data

**Handlebars:**
```handlebars
{{!-- Loop through instances --}}
{{#each instances}}
  <div>{{name}}</div>
{{/each}}

{{!-- Look up by ID --}}
{{#with (lookup instances_by_id "web-01")}}
  <h1>{{name}}</h1>
{{/with}}

{{!-- Access build info --}}
<p>Built: {{buildContext.timestamp}}</p>
```

**Nunjucks:**
```nunjucks
{# Loop through instances #}
{% for instance in instances %}
  <div>{{ instance.name }}</div>
{% endfor %}

{# Look up by ID #}
{% set web = instances_by_id["web-01"] %}
<h1>{{ web.name }}</h1>

{# Access build info #}
<p>Built: {{ buildContext.timestamp }}</p>
```

---

## Single-File Templates

Most templates generate a single output file:

**`templates/index.html.hbs`:**
```handlebars
<!DOCTYPE html>
<html>
<head>
  <title>My Site</title>
</head>
<body>
  <h1>Posts</h1>
  {{#each (where instances "class" "post")}}
    <article>
      <h2>{{title}}</h2>
      <p>{{excerpt}}</p>
    </article>
  {{/each}}
</body>
</html>
```

**Output:** `build/build-abc123/index.html`

---

## Multi-File Generation with render_file

The `render_file` helper generates multiple output files from a single template:

### Syntax

```handlebars
{{render_file "template-name.hbs" "output-path" context}}
```

**Parameters:**
1. `template-name.hbs` - Template to render (in templates directory)
2. `output-path` - Relative path for output (from build directory)
3. `context` - Data to pass to template (usually `this`)

### Example: Generate Per-Instance Pages

**`templates/index.html.hbs`:**
```handlebars
<!DOCTYPE html>
<html>
<body>
  <h1>Posts</h1>
  <ul>
    {{#each (where instances "class" "post")}}
      <li><a href="posts/{{id}}.html">{{title}}</a></li>
      
      {{!-- Generate individual post page --}}
      {{render_file "post.html.hbs" (concat "posts/" id ".html") this}}
    {{/each}}
  </ul>
</body>
</html>
```

**`templates/post.html.hbs`:**
```handlebars
<!DOCTYPE html>
<html>
<body>
  <article>
    <h1>{{title}}</h1>
    <p>By {{author}} on {{created_at}}</p>
    <div>{{content}}</div>
  </article>
</body>
</html>
```

**Outputs:**
```
build/build-abc123/
├── index.html
└── posts/
    ├── welcome.html
    ├── intro-to-struktur.html
    └── my-third-post.html
```

### render_file Context

The third parameter determines what data the rendered template sees:

**Pass current instance:**
```handlebars
{{#each instances}}
  {{render_file "detail.hbs" (concat id ".html") this}}
  <!--                                          ^^^^ instance data only -->
{{/each}}
```

**Pass full context:**
```handlebars
{{#each instances}}
  {{render_file "detail.hbs" (concat id ".html") ..}}
  <!--                                           ^^ parent context (all data) -->
{{/each}}
```

**Pass custom context:**
```handlebars
{{render_file "stats.html" "stats.html" (hash 
  total=(length instances)
  classes=(pluck classes "class")
)}}
```

---

## Template Collision Detection

When multiple template directories contain files with the same path:

### Default: Strict Mode (Fails)

```bash
struktur build base/ overlay/
```

**If both have `index.html.hbs`:**
```
⚠ 1 template collision(s) detected:

Template: index.html.hbs
Sources:
  overridden: base/templates
  → USED: overlay/templates

Note: Later directories override earlier ones.
      Collisions fail by default. Use --allow-template-collisions to permit.
```

**Build fails** - Must resolve collision.

### Allow Collisions (Last Wins)

```bash
struktur build base/ overlay/ --allow-template-collisions
```

**Behavior:** `overlay/templates/index.html.hbs` is used, `base/templates/index.html.hbs` ignored.

**Use case:** Intentional template overriding (theme system, customization).

---

## Template Helpers

Templates can use built-in helpers. See [Helper Reference](helpers-reference.md) for complete list.

### Common Patterns

**Filter by class:**
```handlebars
{{#each (where instances "class" "post")}}
  <h2>{{title}}</h2>
{{/each}}
```

**Filter by inheritance:**
```handlebars
{{#each (filter_inherits instances "entity_base" classes_by_id)}}
  <div class="entity">{{name}}</div>
{{/each}}
```

**Sort and group:**
```handlebars
{{#each (group_by (sort_by posts "date") "category")}}
  <h2>{{@key}}</h2>
  {{#each this}}
    <li>{{title}}</li>
  {{/each}}
{{/each}}
```

**Conditional rendering:**
```handlebars
{{#if (eq status "published")}}
  <article>{{content}}</article>
{{/if}}

{{#if $aspects.monitoring}}
  <div>Monitoring: :{{$aspects.monitoring.port}}</div>
{{/if}}
```

---

## Partials

Reusable template fragments:

### Handlebars Partials

**`templates/partials/header.hbs`:**
```handlebars
<header>
  <h1>{{site_title}}</h1>
  <nav>{{nav_items}}</nav>
</header>
```

**Usage:**
```handlebars
{{> header}}
<main>
  {{content}}
</main>
```

### Nunjucks Includes

**`templates/partials/header.njk`:**
```nunjucks
<header>
  <h1>{{ site_title }}</h1>
</header>
```

**Usage:**
```nunjucks
{% include "partials/header.njk" %}
<main>
  {{ content }}
</main>
```

---

## Template Organization Patterns

### Pattern 1: Flat Structure

```
templates/
├── index.html.hbs
├── about.html.hbs
└── contact.html.hbs
```

**Use for:** Simple sites with few templates.

### Pattern 2: By Feature

```
templates/
├── posts/
│   ├── index.html.hbs
│   ├── post.html.hbs
│   └── archive.html.hbs
├── pages/
│   ├── about.html.hbs
│   └── contact.html.hbs
└── partials/
    ├── header.hbs
    └── footer.hbs
```

**Use for:** Organized by content type.

### Pattern 3: By Layer

```
templates/
├── layouts/
│   ├── base.hbs
│   └── post.hbs
├── components/
│   ├── card.hbs
│   └── list.hbs
└── pages/
    ├── index.hbs
    └── about.hbs
```

**Use for:** Component-based architecture.

---

## Common Template Patterns

### Generate Index + Detail Pages

**Index lists all, generates details:**
```handlebars
<!DOCTYPE html>
<html>
<body>
  <h1>All Items</h1>
  {{#each instances}}
    <a href="{{id}}.html">{{name}}</a>
    {{render_file "detail.html.hbs" (concat id ".html") this}}
  {{/each}}
</body>
</html>
```

### Generate Per-Category Pages

```handlebars
{{#each (group_by instances "category")}}
  {{render_file "category.html.hbs" (concat "categories/" @key ".html") (hash
    category=@key
    items=this
  )}}
{{/each}}
```

### Conditional File Generation

```handlebars
{{#each instances}}
  {{#if (eq status "published")}}
    {{render_file "published.html.hbs" (concat "posts/" id ".html") this}}
  {{/if}}
{{/each}}
```

### Nested Directory Generation

```handlebars
{{#each instances}}
  {{render_file "detail.html.hbs" (concat class "/" id ".html") this}}
{{/each}}
```

**Output:**
```
build/
├── server/
│   ├── web-01.html
│   └── web-02.html
└── database/
    └── db-01.html
```

---

## Template Best Practices

### 1. Separation of Concerns

**Templates for presentation only:**
- Don't perform complex logic
- Don't modify data
- Don't have side effects

**Do logic in helpers or preprocessing.**

### 2. DRY with Partials

```handlebars
{{!-- Instead of duplicating --}}
<header>
  <h1>{{title}}</h1>
  <nav>...</nav>
</header>

{{!-- Use partial --}}
{{> header}}
```

### 3. Context-Aware Templates

```handlebars
{{!-- Pass minimal context to render_file --}}
{{render_file "post.html.hbs" "output.html" this}}

{{!-- Not full context unless needed --}}
{{render_file "post.html.hbs" "output.html" ..}}
```

### 4. Predictable Paths

```handlebars
{{!-- Good: deterministic paths --}}
{{render_file "post.html.hbs" (concat "posts/" id ".html") this}}

{{!-- Bad: spaces, special characters --}}
{{render_file "post.html.hbs" (concat title ".html") this}}
<!-- title = "My Post!" → "My Post!.html" (invalid) -->
```

Use `slugify` for safe paths:
```handlebars
{{render_file "post.html.hbs" (concat "posts/" (slugify title) ".html") this}}
```

### 5. Template Comments

**Handlebars:**
```handlebars
{{!-- This is a comment, not rendered --}}
```

**Nunjucks:**
```nunjucks
{# This is a comment #}
```

---

## Debugging Templates

### Inspect Context

```handlebars
<pre>{{json this}}</pre>
```

Shows complete context object.

### Check Available Data

```handlebars
<h2>Available Context</h2>
<ul>
  <li>Instances: {{length instances}}</li>
  <li>Classes: {{length classes}}</li>
  <li>Aspects: {{length aspects}}</li>
</ul>
```

### Debug Helpers

```handlebars
{{!-- Check if helper works --}}
Result: {{slugify "Hello World"}}
<!-- Should show: hello-world -->

{{!-- Check filter result --}}
{{#each (where instances "class" "post")}}
  Found: {{id}}
{{/each}}
```

### Validate Rendered Output

```bash
# Build and check output
struktur build . && cat build/build-*/index.html
```

---

## Path Safety

All output paths are resolved relative to build directory:

**Safe:**
```handlebars
{{render_file "post.html.hbs" "posts/welcome.html" this}}
{{render_file "post.html.hbs" "subdirectory/file.html" this}}
```

**Blocked:**
```handlebars
{{render_file "post.html.hbs" "/etc/passwd" this}}
{{render_file "post.html.hbs" "../../../etc/passwd" this}}
```

**Error:**
```
Error: Output path outside build directory
Attempted: /etc/passwd
```

---

## Common Errors

### Template Not Found

```
Error: Template not found: post.html.hbs
```

**Fix:** Ensure template exists in templates directory.

### render_file Context Error

```
Error: render_file requires context parameter
```

**Fix:** Pass context (usually `this`):
```handlebars
{{render_file "post.html.hbs" "output.html" this}}
```

### Undefined Variable

```
Error: "author" is undefined
```

**Fix:** Check variable exists or use default:
```handlebars
{{default author "Anonymous"}}
```

### Invalid Path

```
Error: Output path contains invalid characters
```

**Fix:** Use `slugify` for safe paths:
```handlebars
{{render_file "page.html.hbs" (concat (slugify title) ".html") this}}
```

---

## Best Practices

### 1. Always Quote Environment Values

```handlebars
✅ GOOD
environment:
{{#each $aspects.docker_container.environment}}
  {{@key}}: "{{{this}}}"
{{/each}}

❌ BAD
environment:
{{#each $aspects.docker_container.environment}}
  {{@key}}: {{{this}}}
{{/each}}
```

### 2. Check Before Iterating

```handlebars
✅ GOOD
{{#if $aspects.docker_container.volumes}}
{{#if (gt $aspects.docker_container.volumes.length 0)}}
volumes:
{{#each $aspects.docker_container.volumes}}
  - {{this}}
{{/each}}
{{/if}}
{{/if}}

❌ BAD (outputs empty "volumes:" if array is empty)
{{#if $aspects.docker_container.volumes}}
volumes:
{{#each $aspects.docker_container.volumes}}
  - {{this}}
{{/each}}
{{/if}}
```

### 3. Avoid Deep Nesting

```handlebars
❌ BAD - Hard to maintain
{{#if condition1}}
  {{#if condition2}}
    {{#if condition3}}
      <!-- Deep nesting -->
    {{/if}}
  {{/if}}
{{/if}}

✅ GOOD - Use helpers
{{#if (and condition1 condition2 condition3)}}
  <!-- Clean logic -->
{{/if}}
```

### 4. Document Complex Templates

```handlebars
{{!--
  Template: docker-compose.yml
  Inputs:
    - instances: All instances with docker_container aspect
    - buildContext: Build metadata
  Outputs:
    - docker-compose.yml: Service definitions
  
  Required aspects:
    - docker_container.image OR docker_container.build
--}}
```

### 5. Test Edge Cases

Always test your templates with:
- Empty arrays (`volumes: []`)
- Null values (`command: null`)
- Special characters in strings
- Missing optional fields

### 6. Use Partials for Reusability

```handlebars
{{!-- partials/healthcheck.hbs --}}
{{#if healthcheck}}
healthcheck:
  test: {{healthcheck.test}}
{{/if}}

{{!-- main template --}}
{{> healthcheck healthcheck=$aspects.docker_container.healthcheck}}
```

---

## Troubleshooting

### Mismatched Template Tags

**Error:** `Expecting 'if' but got 'each'`

**Cause:** Unclosed or incorrectly nested tags.

**Fix:** Count your opening/closing tags:
```handlebars
{{#if condition}}      # 1 open
  {{#each items}}      # 2 open
  {{/each}}            # 2 close
{{/if}}                # 1 close
```

### HTML Escaping Issues

**Symptom:** Environment variables contain `&#x3D;`, `&#x27;`, etc.

**Fix:** Use triple-stash `{{{...}}}` for environment variables and commands.

### Empty Sections

**Symptom:** Empty YAML sections like:
```yaml
volumes:
```

**Fix:** Check array length before outputting section headers:
```handlebars
{{#if (gt $aspects.docker_container.volumes.length 0)}}
volumes:
{{#each $aspects.docker_container.volumes}}
  - {{this}}
{{/each}}
{{/if}}
```

### Whitespace Problems

**Symptom:** Extra blank lines in output.

**Fix:** Use `~` to strip whitespace:
```handlebars
{{#each items~}}
{{name}}
{{~/each}}
```

---

## See Also

- [Helper Reference](helpers-reference.md) - All template helpers
- [Tutorial: First Stack](tutorial-first-stack.md) - Template usage examples
- [Concepts: Build Pipeline](concepts-build-pipeline.md) - Render phase details
- [Errors & Troubleshooting](errors-troubleshooting.md) - Template errors
