# Helper Reference

Built-in template helpers for Handlebars and Nunjucks templates.

## Context Structure

All templates receive a context object with the following structure:

```javascript
{
  $instances: [...],           // All instances (array)
  $instances_by_id: {...},     // Instances by $id (object)
  $classes: [...],             // All class definitions (array)
  $classes_by_id: {...},       // Classes by name (object)
  $class_names: [...],         // Class name list
  $aspects: [...],             // All aspect definitions (array)
  $aspects_by_id: {...},       // Aspects by name (object)
  $aspect_names: [...],        // Aspect name list
  $metadata: {                 // Build metadata
    timestamp: "2025-12-16T...",
    version: "0.2.3-alpha",
    generator: "struktur"
  }
}
```

Access instances in templates:

**Handlebars:**
```handlebars
{{#each $instances}}
  <h1>{{name}}</h1>
  <p>Class: {{$class}}</p>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for instance in $instances %}
  <h1>{{ instance.name }}</h1>
  <p>Class: {{ instance.$class }}</p>
{% endfor %}
```

---

## Comparison Helpers

### `eq(a, b)`

Check equality.

**Handlebars:**
```handlebars
{{#if (eq status "published")}}
  <span class="badge">Published</span>
{{/if}}

{{#if (eq user.role "admin")}}
  <button>Delete</button>
{{/if}}
```

**Nunjucks:**
```nunjucks
{% if status | eq("published") %}
  <span class="badge">Published</span>
{% endif %}

{% if user.role | eq("admin") %}
  <button>Delete</button>
{% endif %}
```

---

### `and(...args)`

Logical AND operation.

**Handlebars:**
```handlebars
{{#if (and isActive isVerified)}}
  <span>Active & Verified</span>
{{/if}}

{{#if (and (eq role "admin") (eq status "active"))}}
  <button>Admin Panel</button>
{{/if}}
```

**Nunjucks:**
```nunjucks
{% if and(isActive, isVerified) %}
  <span>Active & Verified</span>
{% endif %}
```

---

### `or(...args)`

Logical OR operation.

**Handlebars:**
```handlebars
{{#if (or isDraft isArchived)}}
  <span class="inactive">Not Published</span>
{{/if}}

{{#if (or (eq role "admin") (eq role "moderator"))}}
  <button>Moderate</button>
{{/if}}
```

**Nunjucks:**
```nunjucks
{% if or(isDraft, isArchived) %}
  <span class="inactive">Not Published</span>
{% endif %}
```

---

## Array Helpers

### `pluck(array, field)`

Extract field from array of objects.

**Handlebars:**
```handlebars
<!-- Get all post titles -->
{{#each (pluck posts "title")}}
  <li>{{this}}</li>
{{/each}}

<!-- Get all author names -->
<p>Authors: {{join (pluck posts "author") ", "}}</p>
```

**Nunjucks:**
```nunjucks
{% for title in posts | pluck("title") %}
  <li>{{ title }}</li>
{% endfor %}
```

---

### `flatten(array)`

Flatten nested arrays one level.

**Handlebars:**
```handlebars
<!-- categories = [["tech", "ai"], ["design"], ["product"]] -->
{{#each (flatten categories)}}
  <span class="tag">{{this}}</span>
{{/each}}
<!-- Output: tech, ai, design, product -->
```

**Nunjucks:**
```nunjucks
{% for tag in categories | flatten %}
  <span class="tag">{{ tag }}</span>
{% endfor %}
```

---

### `unique(array)`

Remove duplicate values.

**Handlebars:**
```handlebars
<!-- tags = ["tech", "ai", "tech", "product", "ai"] -->
{{#each (unique tags)}}
  <span>{{this}}</span>
{{/each}}
<!-- Output: tech, ai, product -->
```

**Nunjucks:**
```nunjucks
{% for tag in tags | unique %}
  <span>{{ tag }}</span>
{% endfor %}
```

---

### `where(array, field, value)`

Filter array by field value.

**Handlebars:**
```handlebars
<!-- Published posts only -->
{{#each (where posts "status" "published")}}
  <article>
    <h2>{{title}}</h2>
    <p>{{excerpt}}</p>
  </article>
{{/each}}

<!-- Posts by specific author -->
{{#each (where posts "author" "Alice")}}
  <li>{{title}}</li>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for post in posts | where("status", "published") %}
  <article>
    <h2>{{ post.title }}</h2>
  </article>
{% endfor %}
```

---

### `where_includes(array, field, needle)`

Filter where field includes value (array field membership).

**Handlebars:**
```handlebars
<!-- Find posts tagged with "tech" -->
{{#each (where_includes posts "tags" "tech")}}
  <h3>{{title}}</h3>
{{/each}}

<!-- posts with tags: ["tech", "ai"] or ["tech"] include "tech" -->
```

**Nunjucks:**
```nunjucks
{% for post in posts | where_includes("tags", "tech") %}
  <h3>{{ post.title }}</h3>
{% endfor %}
```

---

### `compact(array)`

Remove falsy values (null, undefined, false, 0, "", NaN).

**Handlebars:**
```handlebars
<!-- values = ["a", null, "b", undefined, "c", false] -->
{{#each (compact values)}}
  <span>{{this}}</span>
{{/each}}
<!-- Output: a, b, c -->
```

**Nunjucks:**
```nunjucks
{% for val in values | compact %}
  <span>{{ val }}</span>
{% endfor %}
```

---

### `reverse(array)`

Reverse array order.

**Handlebars:**
```handlebars
<!-- Show newest posts first -->
{{#each (reverse posts)}}
  <article>{{title}} - {{date}}</article>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for post in posts | reverse %}
  <article>{{ post.title }}</article>
{% endfor %}
```

---

### `first(array)` / `last(array)`

Get first or last element.

**Handlebars:**
```handlebars
<!-- Latest post -->
<h2>Latest: {{title (first posts)}}</h2>

<!-- Oldest post -->
<h2>Archive: {{title (last posts)}}</h2>
```

**Nunjucks:**
```nunjucks
<h2>Latest: {{ (posts | first).title }}</h2>
<h2>Archive: {{ (posts | last).title }}</h2>
```

---

### `length(value)`

Get length of array or object keys.

**Handlebars:**
```handlebars
<p>Total posts: {{length posts}}</p>

{{#if (eq (length errors) 0)}}
  <p>No errors!</p>
{{/if}}
```

**Nunjucks:**
```nunjucks
<p>Total posts: {{ posts | length }}</p>
```

---

### `sort_by(array, field)`

Sort array by field value.

**Handlebars:**
```handlebars
<!-- Sort posts by title -->
{{#each (sort_by posts "title")}}
  <li>{{title}}</li>
{{/each}}

<!-- Sort users by age -->
{{#each (sort_by users "age")}}
  <li>{{name}} ({{age}})</li>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for post in posts | sort_by("title") %}
  <li>{{ post.title }}</li>
{% endfor %}
```

---

### `group_by(array, field)`

Group array by field value. Returns object with field values as keys.

**Handlebars:**
```handlebars
<!-- Group posts by category -->
{{#each (group_by posts "category")}}
  <h2>{{@key}}</h2>
  <ul>
    {{#each this}}
      <li>{{title}}</li>
    {{/each}}
  </ul>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for category, posts in posts | group_by("category") %}
  <h2>{{ category }}</h2>
  <ul>
    {% for post in posts %}
      <li>{{ post.title }}</li>
    {% endfor %}
  </ul>
{% endfor %}
```

---

## Math Helpers

### `add(a, b)`

Add two numbers.

**Handlebars:**
```handlebars
<p>Total: {{add subtotal tax}}</p>
```

**Nunjucks:**
```nunjucks
<p>Total: {{ add(subtotal, tax) }}</p>
```

---

### `sub(a, b)`

Subtract second number from first.

**Handlebars:**
```handlebars
<p>Delta: {{sub max_price min_price}}</p>
```

**Nunjucks:**
```nunjucks
<p>Delta: {{ sub(max_price, min_price) }}</p>
```

---

### `abs(value)`

Absolute value.

**Handlebars:**
```handlebars
<p>Distance: {{abs (sub a b)}}</p>
```

**Nunjucks:**
```nunjucks
<p>Distance: {{ abs(sub(a, b)) }}</p>
```

---

## String Helpers

### `slugify(str)`

Convert string to URL-friendly slug.

**Handlebars:**
```handlebars
<a href="/posts/{{slugify title}}">{{title}}</a>
<!-- "Hello World!" → "hello-world" -->

<img src="/images/{{slugify author.name}}.jpg">
<!-- "Jane Doe" → "jane-doe" -->
```

**Nunjucks:**
```nunjucks
<a href="/posts/{{ title | slugify }}">{{ title }}</a>
```

---

### `title_case(str)`

Convert to Title Case.

**Handlebars:**
```handlebars
<h1>{{title_case heading}}</h1>
<!-- "hello world" → "Hello World" -->
```

**Nunjucks:**
```nunjucks
<h1>{{ heading | title_case }}</h1>
```

---

### `uppercase(str)` / `lowercase(str)`

Convert case.

**Handlebars:**
```handlebars
<span class="code">{{uppercase status}}</span>
<!-- "active" → "ACTIVE" -->

<input value="{{lowercase email}}">
<!-- "USER@EXAMPLE.COM" → "user@example.com" -->
```

**Nunjucks:**
```nunjucks
<span>{{ status | uppercase }}</span>
<input value="{{ email | lowercase }}">
```

---

### `capitalize(str)`

Capitalize first letter only.

**Handlebars:**
```handlebars
<p>{{capitalize description}}</p>
<!-- "hello world" → "Hello world" -->
```

**Nunjucks:**
```nunjucks
<p>{{ description | capitalize }}</p>
```

---

### `trim(str)`

Remove leading/trailing whitespace.

**Handlebars:**
```handlebars
<span>{{trim content}}</span>
<!-- "  hello  " → "hello" -->
```

**Nunjucks:**
```nunjucks
<span>{{ content | trim }}</span>
```

---

### `substring(str, start, end)`

Extract substring.

**Handlebars:**
```handlebars
<!-- Get excerpt (first 100 chars) -->
<p>{{substring content 0 100}}...</p>

<!-- Skip first 10 chars -->
<p>{{substring text 10}}</p>
```

**Nunjucks:**
```nunjucks
<p>{{ content | substring(0, 100) }}...</p>
```

---

### `replace(str, search, replace)`

Replace text.

**Handlebars:**
```handlebars
<!-- Replace dashes with spaces -->
<p>{{replace slug "-" " "}}</p>
<!-- "hello-world" → "hello world" -->
```

**Nunjucks:**
```nunjucks
<p>{{ slug | replace("-", " ") }}</p>
```

---

### `split(str, delimiter, index?)`

Split string by delimiter.

**Handlebars:**
```handlebars
<!-- Split into array -->
{{#each (split tags ",")}}
  <span>{{trim this}}</span>
{{/each}}

<!-- Get specific part (0-indexed) -->
<p>Domain: {{split email "@" 1}}</p>
<!-- "user@example.com" → "example.com" -->
```

**Nunjucks:**
```nunjucks
{% for tag in tags | split(",") %}
  <span>{{ tag | trim }}</span>
{% endfor %}
```

---

## Data Helpers

### `default_value(value, defaultValue)`

Provide default for falsy values.

**Handlebars:**
```handlebars
<p>Author: {{default_value author "Anonymous"}}</p>
<!-- If author is null/undefined → "Anonymous" -->

<span class="{{default_value priority 'normal'}}">
  {{title}}
</span>
```

**Nunjucks:**
```nunjucks
<p>Author: {{ author | default_value("Anonymous") }}</p>
```

---

### `concat(...args)`

Concatenate strings.

**Handlebars:**
```handlebars
<a href="{{concat "/posts/" slug ".html"}}">
  {{title}}
</a>

<img src="{{concat "/images/" category "/" $id ".jpg"}}">
```

**Nunjucks:**
```nunjucks
<a href="{{ concat("/posts/", slug, ".html") }}">
  {{ title }}
</a>
```

---

### `json(value)`

JSON stringify (for debugging or data attributes).

**Handlebars:**
```handlebars
<script>
  const post = {{{json post}}};
</script>

<div data-config='{{json settings}}'>
  ...
</div>
```

**Nunjucks:**
```nunjucks
<script>
  const post = {{ post | json | safe }};
</script>
```

---

### `values(object)`

Get object values as array.

**Handlebars:**
```handlebars
<!-- $classes_by_id = {post: {...}, page: {...}} -->
{{#each (values $classes_by_id)}}
  <li>{{this.$class}}</li>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for classObj in $classes_by_id | values %}
  <li>{{ classObj.$class }}</li>
{% endfor %}
```

---

### `array(...args)`

Create array from arguments.

**Handlebars:**
```handlebars
{{#each (array "draft" "published" "archived")}}
  <option value="{{this}}">{{this}}</option>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for status in array("draft", "published", "archived") %}
  <option value="{{ status }}">{{ status }}</option>
{% endfor %}
```

---

## Struktur-Specific Helpers

These helpers use Struktur's class resolver and canonical data.

### `inherits(className, targetName, classes)`

Check if class inherits from target class.

**Handlebars:**
```handlebars
{{#each $instances}}
  {{#if (inherits $class "entity_base" $classes_by_id)}}
    <div class="entity">
      {{name}}
    </div>
  {{/if}}
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for instance in $instances %}
  {% if inherits(instance.$class, "entity_base", $classes_by_id) %}
    <div class="entity">{{ instance.name }}</div>
  {% endif %}
{% endfor %}
```

---

### `inherits_any(className, ...targets, classes)`

Check if class inherits from any target.

**Handlebars:**
```handlebars
{{#if (inherits_any $class "page" "post" $classes_by_id)}}
  <article>{{content}}</article>
{{/if}}
```

---

### `inherits_all(className, ...targets, classes)`

Check if class inherits from all targets.

**Handlebars:**
```handlebars
{{#if (inherits_all $class "entity_base" "timestamped" $classes_by_id)}}
  <time>{{created_at}}</time>
{{/if}}
```

---

### `class_lineage(className, classes)`

Get full parent chain.

**Handlebars:**
```handlebars
<!-- Show inheritance chain -->
<p>Lineage: {{join (class_lineage $class $classes_by_id) " → "}}</p>
<!-- Output: entity_base → content_base → post -->
```

**Nunjucks:**
```nunjucks
<p>Lineage: {{ class_lineage($class, $classes_by_id) | join(" → ") }}</p>
```

---

### `filter_inherits(entries, targetName, classes)`

Filter instances by inheritance.

**Handlebars:**
```handlebars
<!-- Get all instances inheriting from "container" -->
{{#each (filter_inherits $instances "container" $classes_by_id)}}
  <div class="container-item">
    {{name}}
  </div>
{{/each}}
```

**Nunjucks:**
```nunjucks
{% for item in $instances | filter_inherits("container", $classes_by_id) %}
  <div>{{ item.name }}</div>
{% endfor %}
```

---

### `schema_required(className, prop, classes)`

Check if property is required in schema.

**Handlebars:**
```handlebars
{{#if (schema_required $class "title" $classes_by_id)}}
  <label>Title <span class="required">*</span></label>
{{/if}}
```

---

### `schema_has(className, prop, classes)`

Check if schema has property defined.

**Handlebars:**
```handlebars
{{#if (schema_has $class "excerpt" $classes_by_id)}}
  <p class="excerpt">{{excerpt}}</p>
{{/if}}
```

---

### `schema_props(className, classes)`

Get all schema property names.

**Handlebars:**
```handlebars
<h3>Properties:</h3>
<ul>
  {{#each (schema_props $class $classes_by_id)}}
    <li>{{this}}</li>
  {{/each}}
</ul>
```

---

### `resolve(tag, defaultValue, context)`

Resolve tag values (e.g., `@domain.name`).

**Handlebars:**
```handlebars
<!-- Resolve domain reference -->
<p>Domain: {{resolve domain "unknown" this}}</p>

<!-- If domain = "@domains/engineering", resolves to instance -->
```

---

## Template Composition Helpers

### `buffer` / `yield()`

Named content buffers for template composition and multi-file output.

**Write to buffer:**

**Nunjucks:**
```nunjucks
{% buffer name="sidebar" %}
  <div class="sidebar">Navigation</div>
{% endbuffer %}
```

**Handlebars:**
```handlebars
{{#buffer name="sidebar"}}
  <div class="sidebar">Navigation</div>
{{/buffer}}
```

**Read from buffer:**

**Nunjucks:**
```nunjucks
<aside>{{ yield('sidebar') }}</aside>

{# With optional default value #}
<aside>{{ yield('sidebar', '<p>No sidebar</p>') }}</aside>
```

**Handlebars:**
```handlebars
<aside>{{{yield "sidebar"}}}</aside>

{{!-- With optional default value --}}
<aside>{{{yield "sidebar" "<p>No sidebar</p>"}}}}</aside>
```

**Parameters:**
- `name` - Buffer name (string)
- `defaultValue` - Optional default if buffer doesn't exist (string)
- `mode` - Write mode: `"replace"` (default), `"append"`, or `"prepend"`
- `destination` - Optional file path for multi-file output

---

### `buffer_exists()`

Check if a buffer has been written.

**Nunjucks:**
```nunjucks
{% if buffer_exists('sidebar') %}
  <aside>{{ yield('sidebar') }}</aside>
{% else %}
  <aside><p>Default sidebar</p></aside>
{% endif %}
```

**Handlebars:**
```handlebars
{{#if (buffer_exists "sidebar")}}
  <aside>{{{yield "sidebar"}}}</aside>
{{else}}
  <aside><p>Default sidebar</p></aside>
{{/if}}
```

**Returns:** Boolean - `true` if buffer exists, `false` otherwise

**Use case:** Conditional layout sections that may or may not be populated.

---

### Buffer Write Modes

```nunjucks
{# Replace (default) - overwrites previous content #}
{% buffer name="title" %}My Page{% endbuffer %}

{# Append - adds to end #}
{% buffer name="scripts" mode="append" %}
  <script src="base.js"></script>
{% endbuffer %}
{% buffer name="scripts" mode="append" %}
  <script src="extra.js"></script>
{% endbuffer %}

{# Prepend - adds to beginning #}
{% buffer name="styles" mode="prepend" %}
  <link href="reset.css">  {# Will appear first #}
{% endbuffer %}
```

**Multi-File Output:**

```nunjucks
{# Write to docker-compose.yml #}
{% buffer name="service" destination="docker-compose.yml" mode="append" %}
services:
  {{$id}}:
    image: {{image}}
{% endbuffer %}

{# Write to README.md #}
{% buffer name="docs" destination="README.md" mode="append" %}
## {{$id}}
Documentation here.
{% endbuffer %}
```

---

### `extends()`

**Recommended Pattern**: Declare layout extension for order-independent template composition.

**Nunjucks:**
```nunjucks
{# Extend a layout - can appear anywhere in template #}
{% extends "layouts/base.html" %}

{# Write buffers in any order #}
{% buffer name="content" %}
  <h1>{{title}}</h1>
  <p>{{description}}</p>
{% endbuffer %}

{% buffer name="title" %}{{title}}{% endbuffer %}
```

**Handlebars:**
```handlebars
{{!-- Extend a layout - can appear anywhere in template --}}
{{extends "layouts/base.html"}}

{{!-- Write buffers in any order --}}
{{#buffer name="content"}}
  <h1>{{title}}</h1>
  <p>{{description}}</p>
{{/buffer}}

{{#buffer name="title"}}{{title}}{{/buffer}}
```

**Layout template:**
```handlebars
<!DOCTYPE html>
<html>
<head>
  <title>{{{yield "title" "Default Title"}}}</title>
  {{{yield "extra_head" ""}}}
</head>
<body>
  <main>{{{yield "content"}}}</main>
</body>
</html>
```

**Parameters:**
- `layoutName` - Layout template filename (string, must include extension)

**Behavior:**
- Template writes buffers first
- Layout renders after with access to all buffers
- Buffer writing order doesn't matter
- More flexible than include-at-end pattern

**Error Handling:**
- Throws if layout not found
- Throws if multiple `extends` calls in same template
- Yields throw `BufferNotFoundError` if buffer missing (unless default provided)

**Best Practice:** Use `extends` at top of template for clarity, but placement doesn't affect behavior.

**Common Use Cases:**
- Layout templates with content areas
- Accumulating scripts/styles from components
- Generating multiple output files from one template
- Template composition without inheritance

**See:** [Concepts: Template Buffers](concepts-template-buffers.md) for comprehensive guide with examples.

---

## Engine-Specific Helpers

### `render_file(template, outputPath, context)`

Render template to separate output file.

**Handlebars:**
```handlebars
{{!-- Main template: index.html.hbs --}}
<!DOCTYPE html>
<html>
<body>
  {{!-- Generate individual post pages --}}
  {{#each (where $instances "$class" "post")}}
    {{render_file "post.html.hbs" (concat "posts/" slug ".html") this}}
  {{/each}}
  
  <ul>
    {{#each (where $instances "$class" "post")}}
      <li><a href="posts/{{slug}}.html">{{title}}</a></li>
    {{/each}}
  </ul>
</body>
</html>

{{!-- post.html.hbs template --}}
<article>
  <h1>{{title}}</h1>
  <div>{{content}}</div>
</article>
```

**Behavior:**
- Renders `template` with provided `context`
- Writes output to `outputPath` (relative to build directory)
- Context can be subset of main context (e.g., single instance)
- Template can be any registered template file
- If `pathPrefix` is not provided in context, it is auto-derived from output depth
- If `pathPrefix` is provided (class `$fields` or explicit override), it is preserved

**Common Pattern - Generate Per-Instance Files:**
```handlebars
{{!-- Generate page for each instance --}}
{{#each $instances}}
  {{render_file "detail.html.hbs" (concat $class "/" $id ".html") this}}
{{/each}}
```

---

## Helper Composition

Combine helpers for powerful transformations:

**Handlebars:**
```handlebars
{{!-- Get unique categories from published posts, sorted --}}
{{#each (sort_by (unique (pluck (where posts "status" "published") "category")))}}
  <a href="/category/{{slugify this}}">{{title_case this}}</a>
{{/each}}

{{!-- Get first 5 posts by specific author --}}
{{#each (first (where posts "author" "Alice") 5)}}
  <h3>{{title}}</h3>
{{/each}}

{{!-- Group published posts by category, show counts --}}
{{#each (group_by (where posts "status" "published") "category")}}
  <h2>{{@key}} ({{length this}})</h2>
  {{#each this}}
    <li>{{title}}</li>
  {{/each}}
{{/each}}
```

---

## Debugging Helpers

### `json` for inspection

**Handlebars:**
```handlebars
<!-- See full instance structure -->
<pre>{{json this}}</pre>

<!-- See what classes are available -->
<script>
  console.log('Classes:', {{{json $classes_by_id}}});
</script>
```

### Check what context is available

**Handlebars:**
```handlebars
<pre>
Available context keys:
{{#each (array "$instances" "$classes" "$aspects" "$metadata")}}
  - {{this}}: {{length (lookup ../ this)}}
{{/each}}
</pre>
```

---

## See Also

- [CLI Reference](cli-reference.md) - `--engine` flag for switching engines
- [Concepts: Templates](concepts-templates.md) - Template loading and rendering
- [Tutorial: First Stack](tutorial-first-stack.md) - Using helpers in templates
