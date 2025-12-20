# Concepts: Template Buffers

Template buffers enable template composition by capturing content for reuse in layouts and multi-file outputs.

## What Are Buffers?

Buffers are **named content containers** that let you:
- Capture template output into named buckets
- Defer where content appears in the final output
- Build flexible layouts with content areas
- Generate multiple files from a single template

Think of buffers as variables for template content.

## Basic Usage

### Writing to a Buffer

Capture content in a named buffer using the `{% buffer %}` block:

**Nunjucks:**
```nunjucks
{% buffer name="sidebar" %}
  <div class="sidebar">
    <h3>Navigation</h3>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </div>
{% endbuffer %}
```

**Handlebars:**
```handlebars
{{#buffer name="sidebar"}}
  <div class="sidebar">
    <h3>Navigation</h3>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </div>
{{/buffer}}
```

### Reading from a Buffer

Output buffer content anywhere using the `yield()` function:

**Nunjucks:**
```nunjucks
<div class="layout">
  <main>{{ yield('content') }}</main>
  <aside>{{ yield('sidebar') }}</aside>
</div>
```

**Handlebars:**
```handlebars
<div class="layout">
  <main>{{{yield "content"}}}</main>
  <aside>{{{yield "sidebar"}}}</aside>
</div>
```

**Note:** Handlebars requires triple-stash `{{{ }}}` to prevent HTML escaping.

---

## Write Modes

Buffers support three write modes to control how content is accumulated:

### 1. Replace (Default)

Each write replaces the previous content:

```nunjucks
{% buffer name="header" %}First{% endbuffer %}
{% buffer name="header" %}Second{% endbuffer %}

{{ yield('header') }}  {# Outputs: Second #}
```

**Use case:** Single content area that gets overwritten.

### 2. Append

Add content to the end:

```nunjucks
{% buffer name="scripts" mode="append" %}
  <script src="base.js"></script>
{% endbuffer %}

{% buffer name="scripts" mode="append" %}
  <script src="extra.js"></script>
{% endbuffer %}

{{ yield('scripts') }}
{# Outputs:
  <script src="base.js"></script>
  <script src="extra.js"></script>
#}
```

**Use case:** Accumulating scripts, styles, or dependencies from multiple components.

### 3. Prepend

Add content to the beginning:

```nunjucks
{% buffer name="styles" mode="prepend" %}
  <link href="theme.css">
{% endbuffer %}

{% buffer name="styles" mode="prepend" %}
  <link href="reset.css">  {# Will appear first #}
{% endbuffer %}

{{ yield('styles') }}
{# Outputs:
  <link href="reset.css">
  <link href="theme.css">
#}
```

**Use case:** Adding high-priority items (like CSS resets) that must appear first.

---

## Common Patterns

### Pattern 1: Layout with Content Areas

**The Problem:** You want a consistent page structure with variable content.

**Solution:** Layout template yields named buffers:

```nunjucks
{# templates/layout.njk #}
<!DOCTYPE html>
<html>
<head>
  <title>{{ yield('title') }}</title>
  {{ yield('extra_head') }}
</head>
<body>
  <header>{{ yield('header') }}</header>
  <main>{{ yield('content') }}</main>
  <footer>{{ yield('footer') }}</footer>
</body>
</html>
```

**Content template writes to buffers:**

```nunjucks
{# templates/page.njk #}
{% buffer name="title" %}My Page{% endbuffer %}

{% buffer name="header" %}
  <h1>Welcome to {{id}}</h1>
{% endbuffer %}

{% buffer name="content" %}
  <article>
    <h2>{{title}}</h2>
    <p>{{description}}</p>
  </article>
{% endbuffer %}

{% buffer name="footer" %}
  <p>&copy; 2025 {{company_name}}</p>
{% endbuffer %}

{# Include layout to render final page #}
{% include 'layout.njk' %}
```

**Result:** Full HTML page with consistent structure and custom content.

---

### Pattern 2: Accumulating Dependencies

**The Problem:** Multiple components need to add scripts/styles to the page.

**Solution:** Components append to shared buffers:

```nunjucks
{# Component A adds its dependency #}
{% buffer name="scripts" mode="append" %}
  <script src="/js/component-a.js"></script>
{% endbuffer %}

<div class="component-a">
  <!-- Component A markup -->
</div>
```

```nunjucks
{# Component B adds its dependency #}
{% buffer name="scripts" mode="append" %}
  <script src="/js/component-b.js"></script>
{% endbuffer %}

<div class="component-b">
  <!-- Component B markup -->
</div>
```

**Layout collects all scripts:**

```nunjucks
{# templates/layout.njk #}
<html>
<body>
  {% include 'component-a.njk' %}
  {% include 'component-b.njk' %}
  
  {# All scripts appear here at the end #}
  {{ yield('scripts') }}
</body>
</html>
```

**Result:** All component scripts automatically gathered and placed before `</body>`.

---

### Pattern 3: Multi-File Output (Advanced)

**The Problem:** You want to generate multiple output files from a single instance.

**Solution:** Use the `destination` parameter to route buffers to different files:

```nunjucks
{# templates/service.njk - generates 2 files #}

{# Write to docker-compose.yml #}
{% buffer name="service" destination="docker-compose.yml" mode="append" %}
services:
  {{id}}:
    image: {{aspects.docker_container.image}}
    ports:
      - "{{aspects.docker_container.port}}:80"
{% endbuffer %}

{# Write to README.md #}
{% buffer name="docs" destination="README.md" mode="append" %}
## Service: {{id}}

**Image:** {{aspects.docker_container.image}}
**Port:** {{aspects.docker_container.port}}
{% endbuffer %}
```

**Result:** 
- `docker-compose.yml` - Gets all service definitions
- `README.md` - Gets all documentation sections

**Use cases:**
- Generating configuration + documentation
- Splitting large configs across files
- Creating index files from multiple instances

---

## Error Handling

### Buffer Not Found

If you try to yield a buffer that doesn't exist, you'll get a clear error:

```
[RENDER] BufferNotFoundError: Buffer 'sidebar' not found in current template

Available buffers: content, header, footer

Common causes:
  - Typo in buffer name (check {% buffer name="..." %})
  - Buffer defined in different template (not accessible across templates)
  - Buffer defined after yield (write before read)

File: templates/page.njk
Line: 42
```

**Solution:** Ensure the buffer is written before it's yielded.

### Invalid Write Mode

If you use an invalid mode, you'll get an error:

```javascript
// Valid modes: replace, append, prepend
{% buffer name="content" mode="invalid" %}  // ❌ Error
```

---

## Best Practices

### 1. Consistent Naming

Use descriptive, consistent names across your templates:

✅ **Good:**
```nunjucks
{% buffer name="page_title" %}
{% buffer name="main_content" %}
{% buffer name="head_scripts" %}
{% buffer name="body_scripts" %}
```

❌ **Bad:**
```nunjucks
{% buffer name="t" %}         {# Too short #}
{% buffer name="content1" %}   {# Generic #}
{% buffer name="pageTitle" %}  {# Inconsistent case #}
```

### 2. Write Before Read

Always write to a buffer before yielding it:

✅ **Good:**
```nunjucks
{% buffer name="title" %}My Page{% endbuffer %}
{{ yield('title') }}  {# Works! #}
```

❌ **Bad:**
```nunjucks
{{ yield('title') }}  {# Error: Buffer not found #}
{% buffer name="title" %}My Page{% endbuffer %}
```

### 3. Use Append for Collections

When accumulating similar items (scripts, styles, list items), use `append`:

```nunjucks
{% for service in services %}
  {% buffer name="service_list" mode="append" %}
    <li>{{service.name}}</li>
  {% endfor %}
{% endfor %}

<ul>{{ yield('service_list') }}</ul>
```

### 4. Document Required Buffers

If your layout expects specific buffers, document them:

```nunjucks
{# layout.njk
   
   Required buffers:
   - title: Page title
   - content: Main page content
   
   Optional buffers:
   - header: Custom header (defaults to site header)
   - footer: Custom footer (defaults to site footer)
#}
<!DOCTYPE html>
<html>
  <!-- ... -->
</html>
```

### 5. Avoid Deep Nesting

Keep buffer logic shallow for maintainability:

✅ **Good:**
```nunjucks
{# Content writes to buffers #}
{% buffer name="content" %}...{% endbuffer %}

{# Layout yields buffers #}
{% include 'layout.njk' %}
```

❌ **Confusing:**
```nunjucks
{# Layout includes content that includes another layout #}
{% include 'layout1.njk' %}  {# Which includes... #}
  {% include 'content.njk' %}  {# Which includes... #}
    {% include 'layout2.njk' %}  {# Buffer scope unclear #}
```

---

## Comparison with Other Approaches

### Buffers vs. Block Inheritance

**Traditional block inheritance** (Jinja2 `{% extends %}`):
- Child template extends parent
- Blocks define override points
- Linear parent-child relationship

**Struktur buffers:**
- Content writes to named buffers
- Layout yields buffer content
- Flexible composition (no required hierarchy)
- Multiple content templates can contribute to one layout

**Why buffers?**
- Simpler mental model (write → read)
- Works with any template engine (Handlebars, Nunjucks)
- Supports multi-file output
- No implicit parent-child coupling

### Buffers vs. Partials

**Partials** (template includes):
- Static content reuse
- No content customization

**Buffers:**
- Dynamic content areas
- Layout composition
- Multi-file routing

**Use both:** Partials for reusable components, buffers for layout structure.

---

## Technical Details

### Buffer Scope

Buffers are **template-scoped**: Each template has its own buffer namespace. Buffers written in one template are not accessible in other templates unless you explicitly include or compose them.

### Buffer Lifecycle

1. **Write phase:** `{% buffer %}` blocks execute and store content
2. **Read phase:** `{{ yield() }}` retrieves content from buffers
3. **Output phase:** Final template result written to file(s)

### Implementation

Buffers are managed by `RenderContext`:
- Each render gets a fresh context
- Context tracks all named buffers
- Buffers can have optional file destinations
- Three write modes: replace, append, prepend

See [src/buffer.js](../src/buffer.js) and [src/render_context.js](../src/render_context.js) for implementation details.

---

## Examples

### Example 1: Simple Layout

**Directory structure:**
```
templates/
├── layout.njk
└── home.njk
```

**layout.njk:**
```nunjucks
<!DOCTYPE html>
<html>
<head>
  <title>{{ yield('title') }}</title>
</head>
<body>
  <h1>{{ yield('heading') }}</h1>
  <main>{{ yield('content') }}</main>
</body>
</html>
```

**home.njk:**
```nunjucks
{% buffer name="title" %}Home - My Site{% endbuffer %}
{% buffer name="heading" %}Welcome Home{% endbuffer %}
{% buffer name="content" %}
  <p>This is the home page content.</p>
{% endbuffer %}

{% include 'layout.njk' %}
```

**Result (home.html):**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Home - My Site</title>
</head>
<body>
  <h1>Welcome Home</h1>
  <main>
    <p>This is the home page content.</p>
  </main>
</body>
</html>
```

---

### Example 2: Multi-File Output

**Template (service.njk):**
```nunjucks
{# Write service to docker-compose.yml #}
{% buffer name="docker_service" destination="docker-compose.yml" mode="append" %}
  {{id}}:
    image: {{aspects.docker_container.image}}
    ports:
      - "{{aspects.docker_container.port}}:{{aspects.docker_container.internal_port}}"
    environment:
      NODE_ENV: production
{% endbuffer %}

{# Write docs to README.md #}
{% buffer name="service_docs" destination="README.md" mode="append" %}
### {{id}}

- **Image:** {{aspects.docker_container.image}}
- **Port:** {{aspects.docker_container.port}}
- **Status:** {{status}}
{% endbuffer %}
```

**Instances:**
```json
[
  {"id": "web", "class": "service", "aspects": {"docker_container": {"image": "nginx", "port": 80, "internal_port": 80}}},
  {"id": "api", "class": "service", "aspects": {"docker_container": {"image": "node:18", "port": 3000, "internal_port": 3000}}}
]
```

**Result - docker-compose.yml:**
```yaml
  web:
    image: nginx
    ports:
      - "80:80"
    environment:
      NODE_ENV: production
  api:
    image: node:18
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
```

**Result - README.md:**
```markdown
### web

- **Image:** nginx
- **Port:** 80
- **Status:** active

### api

- **Image:** node:18
- **Port:** 3000
- **Status:** active
```

---

## Summary

**Buffers enable:**
- ✅ Flexible template composition
- ✅ Layouts with named content areas
- ✅ Accumulating dependencies (scripts/styles)
- ✅ Multi-file output from single template
- ✅ Clean separation of content and layout

**Key concepts:**
- Write to buffers with `{% buffer %}`
- Read from buffers with `{{ yield() }}`
- Three modes: replace (default), append, prepend
- Optional `destination` for multi-file output

**Next steps:**
- See [Concepts: Templates](concepts-templates.md) for template fundamentals
- See [Helpers Reference](helpers-reference.md) for all available helpers
- Try the layout pattern in your own stack!
