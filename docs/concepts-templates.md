# Concepts: Templates

Understanding template loading, rendering, and the render_file helper.

## Overview

Templates transform validated data into output files. Struktur uses template engines (Handlebars by default, Nunjucks optional) to render text-based outputs: HTML, YAML, JSON, shell scripts, configuration files, or any text format.

```
Validated Data + Template = Generated Output
```

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

{{#if aspects.monitoring}}
  <div>Monitoring: :{{aspects.monitoring.port}}</div>
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

## See Also

- [Helper Reference](helpers-reference.md) - All template helpers
- [Tutorial: First Stack](tutorial-first-stack.md) - Template usage examples
- [Concepts: Build Pipeline](concepts-build-pipeline.md) - Render phase details
- [Errors & Troubleshooting](errors-troubleshooting.md) - Template errors
