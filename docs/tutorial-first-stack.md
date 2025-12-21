# Tutorial: Your First Stack

Build a complete blog stack from scratch in 20 minutes. Learn classes, schemas, instances, and templates through hands-on practice. (15 steps total)

## What You'll Build

A blog with:
- Posts and pages (different content types)
- Authors (referenced from content)
- Categories (for organization)
- HTML output with index and individual pages

## Prerequisites

- Struktur installed (`npm install -g @nucleic-se/struktur@alpha`)
- Basic familiarity with JSON
- Text editor

---

## Step 1: Create Project Structure

```bash
mkdir blog-stack && cd blog-stack
mkdir classes instances templates
```

**Directory structure:**
```
blog-stack/
├── classes/      # Class definitions and schemas
├── instances/    # Data files
└── templates/    # Handlebars templates
```

---

## Step 2: Define Base Class

Create the foundation class with defaults and validation.

**`classes/content.schema.json`:**
```json
{
  "class": "content",
  "parent": null,
  "title": "",
  "author": null,
  "created_at": "2025-01-01",
  "status": "draft",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "author": {
        "type": "string"
      },
      "created_at": {
        "type": "string",
        "format": "date"
      },
      "status": {
        "type": "string",
        "enum": ["draft", "published", "archived"]
      }
    },
    "required": ["title", "author"]
  }
}
```

**What this means:**
- `class`: Unique identifier matching filename (`content`)
- `parent: null`: Top-level class (no inheritance)
- Top-level fields: Default values for all content
- `schema`: Validation rules (types, constraints, required fields)
- `required`: Fields that must be present (title, author)
- `enum`: Allowed values for status
- `minLength/maxLength`: String constraints

---

## Step 3: Validate Structure So Far

```bash
struktur info -c classes/
```

**Expected output:**
```
=== Classes ===
  content (inherits: none)

Total: 1 classes
```

✅ **Checkpoint:** One class loaded with schema.

---

## Step 4: Create Specialized Classes

Add classes that inherit from content.

**`classes/post.schema.json`:**
```json
{
  "class": "post",
  "parent": "content",
  "category": "general",
  "excerpt": "",
  "content": "",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "category": {
        "type": "string"
      },
      "excerpt": {
        "type": "string",
        "maxLength": 200
      },
      "content": {
        "type": "string"
      }
    },
    "required": ["category", "content"]
  }
}
```

**`classes/page.schema.json`:**
```json
{
  "class": "page",
  "parent": "content",
  "slug": "",
  "content": "",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "slug": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      },
      "content": {
        "type": "string"
      }
    },
    "required": ["slug", "content"]
  }
}
```

---

## Step 5: Check Inheritance

```bash
struktur info -c classes/
```

**Expected output:**
```
=== Classes ===
  content (inherits: none)
  page (inherits: content)
  post (inherits: content)

Total: 3 classes
```

✅ **Checkpoint:** Inheritance chain working.

---

## Step 6: Create Instances

Add actual blog content.

**`instances/welcome-post.json`:**
```json
{
  "id": "welcome",
  "class": "post",
  "title": "Welcome to My Blog",
  "description": "First post introducing the blog",
  "author": "Alice",
  "created_at": "2025-12-01",
  "status": "published",
  "category": "announcements",
  "excerpt": "Welcome! This is the first post on my new blog.",
  "content": "I'm excited to share my thoughts on technology, design, and life. Stay tuned for regular updates!"
}
```

**`instances/first-tech-post.json`:**
```json
{
  "id": "struktur-intro",
  "class": "post",
  "title": "Introduction to Struktur",
  "description": "Tutorial post about Struktur basics",
  "author": "Bob",
  "created_at": "2025-12-10",
  "status": "published",
  "category": "tech",
  "excerpt": "Struktur is a data-driven build system.",
  "content": "Struktur separates data from presentation. You define classes and instances in JSON, then render them with templates. It's perfect for documentation, infrastructure code, and configuration management."
}
```

**`instances/about-page.json`:**
```json
{
  "id": "about",
  "class": "page",
  "title": "About This Blog",
  "description": "Information about the blog and its author",
  "author": "Alice",
  "created_at": "2025-12-01",
  "status": "published",
  "slug": "about",
  "content": "This blog is about technology, design, and creativity. Built with Struktur!"
}
```

---

## Step 7: Validate Instances

```bash
struktur validate -c classes/ -i instances/
```

**Expected output:**
```
=== Validation Results ===

✓ about (page)
✓ struktur-intro (post)
✓ welcome (post)

=== Summary ===
Total:    3
Valid:    3
Invalid:  0
Errors:   0
```

✅ **Checkpoint:** All instances valid against schemas.

---

## Step 8: Test Validation Errors

Try creating an invalid instance to see validation in action.

**`instances/invalid.json`:**
```json
{
  "id": "invalid-post",
  "class": "post",
  "title": "Missing Required Fields"
}
```

```bash
struktur validate -c classes/ -i instances/
```

**Expected error:**
```
=== Validation Results ===

✓ about (page)
✓ struktur-intro (post)
✗ invalid-post (post)
    ERROR: [content] / missing required field: author
    ERROR: [post] / missing required field: category
    ERROR: [post] / missing required field: content
    WARNING: Instance 'invalid-post' has no description
✓ welcome (post)

=== Summary ===
Total:    4
Valid:    3
Invalid:  1
Errors:   3
Warnings: 1
```

**Fix it by removing the file:**
```bash
rm instances/invalid.json
struktur validate -c classes/ -i instances/
```

✅ **Learning:** Validation catches missing required fields from both parent and child schemas.

---

## Step 9: Add Global Configuration

Before creating templates, we need a global configuration that specifies build tasks.

**`classes/global.schema.json`:**
```json
{
  "class": "global",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "id": {"type": "string"},
      "class": {"type": "string"},
      "description": {"type": "string"},
      "build": {"type": "array"}
    }
  }
}
```

**`instances/global.json`:**
```json
{
  "id": "global",
  "class": "global",
  "description": "Blog configuration",
  "build": [
    {
      "index.html": "/index.html"
    }
  ]
}
```

✅ **Learning:** The `build` array tells Struktur which templates to render and where to put them.

---

## Step 10: Create Index Template

**`templates/index.html`** (note: no `.hbs` extension!):
```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Blog</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    article { margin: 2rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; }
    .meta { color: #666; font-size: 0.9rem; }
    .category { background: #e3f2fd; padding: 0.25rem 0.5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>My Blog</h1>
    <nav>
      <a href="index.html">Home</a>
      {{#each (where $instances "class" "page")}}
        <a href="{{slug}}.html">{{title}}</a>
      {{/each}}
    </nav>
  </header>

  <main>
    <h2>Recent Posts</h2>
    
    {{#each (where $instances "class" "post")}}
      {{#if (eq status "published")}}
        <article>
          <h3>{{title}}</h3>
          <p class="meta">
            By {{author}} on {{created_at}}
            <span class="category">{{category}}</span>
          </p>
          <p>{{excerpt}}</p>
          <a href="posts/{{id}}.html">Read more →</a>
        </article>
      {{/if}}
    {{/each}}
  </main>

  <footer>
    <p>Total posts: {{length (where $instances "class" "post")}}</p>
    <p>Built with Struktur at {{$metadata.timestamp}}</p>
  </footer>
</body>
</html>
```

**Helpers used:**
- `where`: Filter instances by field value
- `eq`: Compare values
- `length`: Count items

---

## Step 11: Create Post Template

**`templates/post.html`:**
```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}} - My Blog</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .meta { color: #666; }
    .content { line-height: 1.6; margin: 2rem 0; }
  </style>
</head>
<body>
  <nav><a href="../index.html">← Back to Home</a></nav>
  
  <article>
    <h1>{{title}}</h1>
    <p class="meta">
      By {{author}} on {{created_at}} in {{category}}
    </p>
    <div class="content">
      {{content}}
    </div>
  </article>
</body>
</html>
```

---

## Step 12: Create Page Template

**`templates/page.html`:**
```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}} - My Blog</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .content { line-height: 1.6; }
  </style>
</head>
<body>
  <nav><a href="index.html">← Back to Home</a></nav>
  
  <article>
    <h1>{{title}}</h1>
    <div class="content">
      {{content}}
    </div>
  </article>
</body>
</html>
```

---

## Step 13: Add Multi-Page Generation

Update index template to generate individual pages using `render_file`.

**`templates/index.html`** (add before closing `</body>`):
```handlebars
  {{!-- Generate individual post pages --}}
  {{#each (where $instances "class" "post")}}
    {{render_file "post.html" (concat "posts/" id ".html") this}}
  {{/each}}
  
  {{!-- Generate individual page files --}}
  {{#each (where $instances "class" "page")}}
    {{render_file "page.html" (concat slug ".html") this}}
  {{/each}}

</body>
</html>
```

---

## Step 14: Build!

```bash
struktur build -c classes/ -i instances/ -t templates/ --exact
```

**Expected output:**
```
📦 Loading stack...
  ✓ Loaded 4 classes
  ✓ Loaded 4 instances

🔍 Validating stack...
  ✓ All 4 class-bearing instances valid

📁 Preparing build directory: ./build

📝 Writing outputs...
  ✓ canonical.json (4 instances)
  ✓ meta/classes/ (4 classes)
  ✓ meta/validation.json

🎨 Rendering templates...
  Found 1 build tasks
  ✓ 4 files rendered

✨ Build complete!
  📊 4 instances validated
  📦 4 class definitions
  🎨 4 templates rendered
  📂 ./build/

✨ Open ./build/index.html to view your stack
```

**Build output files:**
```
build/
├── .struktur-manifest.json
├── canonical.json
├── index.html
├── about.html
├── meta/
│   ├── classes/
│   │   ├── content.json
│   │   ├── global.json
│   │   ├── page.json
│   │   └── post.json
│   └── validation.json
└── posts/
    ├── struktur-intro.html
    └── welcome.html
```

---

## Step 15: View Your Blog

```bash
open build/index.html
```

**You should see:**
- Homepage with 2 published posts
- Navigation with "About" link
- Post excerpts with "Read more" links
- Individual post pages in `posts/` directory
- About page

✅ **Success!** You've built a complete static blog.

---

## What You Learned

### Classes & Inheritance
- Base class (`content`) provides common fields
- Child classes (`post`, `page`) add specialized fields
- Instances inherit defaults from class hierarchy

### Schemas & Validation
- Schemas define structure and constraints
- Validation checks instances against class schema chain
- Required fields can come from parent schemas

### Templates & Helpers
- `where`: Filter by field value
- `eq`: Conditional rendering
- `render_file`: Generate multiple output files
- Context includes all instances, classes, $metadata

### Build Pipeline
1. **Load** - Discover classes, schemas, instances
2. **Merge** - Combine instance data with class defaults
3. **Validate** - Check merged data against schemas
4. **Render** - Execute templates with validated data

---

## Next Steps

### Add More Features

**1. Draft posts (already supported):**
```json
{
  "id": "draft-post",
  "class": "post",
  "title": "Coming Soon",
  "status": "draft",
  ...
}
```
Won't appear (filtered by `{{#if (eq status "published")}}`)

**2. Sort posts by date:**
```handlebars
{{#each (reverse (sort_by (where $instances "class" "post") "created_at"))}}
  <article>{{title}}</article>
{{/each}}
```

**3. Group by category:**
```handlebars
{{#each (group_by (where $instances "class" "post") "category")}}
  <h2>{{@key}}</h2>
  {{#each this}}
    <li>{{title}}</li>
  {{/each}}
{{/each}}
```

**4. Add author class:**
```json
// classes/author.json
{
  "class": "author",
  "parent": null,
  "name": "",
  "bio": "",
  "email": ""
}

// instances/alice.json
{
  "id": "alice",
  "class": "author",
  "name": "Alice Smith",
  "bio": "Tech writer and developer",
  "email": "alice@example.com"
}

// Reference in post:
{
  "id": "my-post",
  "class": "post",
  "author": "@alice",  // Tag reference
  ...
}
```

### Learn Advanced Concepts

- **[Tutorial: Extending Universal](tutorial-extending-universal.md)** - Use aspect composition
- **[Concepts: Validation](concepts-validation.md)** - Multi-pass validation deep dive
- **[Concepts: Templates](concepts-templates.md)** - Advanced rendering patterns
- **[Helper Reference](helpers-reference.md)** - All 60+ helpers

### Study Real Examples

```bash
# Docker container stack
struktur init --example docked
cd docked
cat README.md  # Comprehensive example with relationships

# Static site generator (more complex blog)
struktur init --example skribe
cd skribe
cat README.md
```

---

## Troubleshooting

### Validation fails with "property required"
- Check schema `required` array
- Remember parent classes can require fields too
- Use `struktur info -c classes/` to see full schema chain

### Template shows `[object Object]`
- Use `{{json this}}` to inspect context
- Access object properties: `{{author.name}}`
- Use helpers: `{{pluck posts "title"}}`

### `render_file` doesn't work
- Ensure context passed: `{{render_file "template.hbs" "output.html" this}}`
- Check template exists in templates directory
- Verify output path is relative (no leading `/`)

### Build output disappears
- Deterministic builds create `build/build-<hash>/` directories
- Use `--no-deterministic -b build/` for stable output path
- Or use `build/build-*/` glob pattern

---

## Summary

You built a complete blog stack with:
- ✅ 3 classes (content, post, page) with inheritance
- ✅ 3 schemas with validation rules
- ✅ 3 instances (2 posts, 1 page)
- ✅ 3 templates generating 5 HTML files
- ✅ Navigation, filtering, multi-page generation

**Key takeaway:** Struktur separates data structure (classes/schemas) from data content (instances) from presentation (templates). Change any layer independently!

Ready for more? Try [Extending Universal](tutorial-extending-universal.md) to learn aspect composition and domain organization.
