# Tutorial: Your First Stack

Build a complete blog stack from scratch in 20 minutes. Learn classes, schemas, instances, and templates through hands-on practice.

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

Create the foundation class all content inherits from.

**`classes/content.json`:**
```json
{
  "class": "content",
  "parent": null,
  "title": "",
  "author": null,
  "created_at": "2025-01-01",
  "status": "draft"
}
```

**What this means:**
- `class`: Unique identifier matching filename
- `parent: null`: Top-level class (no inheritance)
- Other fields: Default values for all content

---

## Step 3: Define Schema

Add validation rules for the content class.

**`classes/content.schema.json`:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "class": "content",
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
```

**Key points:**
- `"class"` field must match filename (required since v0.2.0)
- `required`: Fields that must be present
- `enum`: Allowed values for status
- `minLength/maxLength`: String constraints

---

## Step 4: Validate Structure So Far

```bash
struktur info -c classes/
```

**Expected output:**
```
Classes loaded: 1

content
  parent: (none)
  schema: content.schema.json
  fields: title, author, created_at, status
```

✅ **Checkpoint:** One class loaded with schema.

---

## Step 5: Create Specialized Classes

Add classes that inherit from content.

**`classes/post.json`:**
```json
{
  "class": "post",
  "parent": "content",
  "category": "general",
  "excerpt": "",
  "content": ""
}
```

**`classes/post.schema.json`:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "class": "post",
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
```

**`classes/page.json`:**
```json
{
  "class": "page",
  "parent": "content",
  "slug": "",
  "content": ""
}
```

**`classes/page.schema.json`:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "class": "page",
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
```

---

## Step 6: Check Inheritance

```bash
struktur info -c classes/
```

**Expected output:**
```
Classes loaded: 3

content
  parent: (none)
  schema: content.schema.json

post
  parent: content
  schema: post.schema.json
  
page
  parent: content
  schema: page.schema.json
```

✅ **Checkpoint:** Inheritance chain working.

---

## Step 7: Create Instances

Add actual blog content.

**`instances/welcome-post.json`:**
```json
{
  "id": "welcome",
  "class": "post",
  "title": "Welcome to My Blog",
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
  "author": "Alice",
  "created_at": "2025-12-01",
  "status": "published",
  "slug": "about",
  "content": "This blog is about technology, design, and creativity. Built with Struktur!"
}
```

---

## Step 8: Validate Instances

```bash
struktur validate -c classes/ -i instances/
```

**Expected output:**
```
✓ Loaded 3 classes
✓ Loaded 3 instances
✓ Validation passed
  - welcome (post)
  - struktur-intro (post)
  - about (page)
```

✅ **Checkpoint:** All instances valid against schemas.

---

## Step 9: Test Validation Errors

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
✗ Validation failed

Error (instance: invalid-post)
  Property "author" is required but not provided
  Schema: content.schema.json (from parent class "content")

Error (instance: invalid-post)
  Property "category" is required but not provided
  Schema: post.schema.json

Error (instance: invalid-post)
  Property "content" is required but not provided
  Schema: post.schema.json
```

**Fix it by removing the file:**
```bash
rm instances/invalid.json
struktur validate -c classes/ -i instances/
# ✓ Validation passed
```

✅ **Learning:** Validation catches missing required fields from both parent and child schemas.

---

## Step 10: Create Index Template

**`templates/index.html.hbs`:**
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
      {{#each (where instances "class" "page")}}
        <a href="{{slug}}.html">{{title}}</a>
      {{/each}}
    </nav>
  </header>

  <main>
    <h2>Recent Posts</h2>
    
    {{#each (where instances "class" "post")}}
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
    <p>Total posts: {{length (where instances "class" "post")}}</p>
    <p>Built with Struktur at {{buildContext.timestamp}}</p>
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

**`templates/post.html.hbs`:**
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

**`templates/page.html.hbs`:**
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

**`templates/index.html.hbs`** (add before closing `</body>`):
```handlebars
  {{!-- Generate individual post pages --}}
  {{#each (where instances "class" "post")}}
    {{render_file "post.html.hbs" (concat "posts/" id ".html") this}}
  {{/each}}
  
  {{!-- Generate individual page files --}}
  {{#each (where instances "class" "page")}}
    {{render_file "page.html.hbs" (concat slug ".html") this}}
  {{/each}}

</body>
</html>
```

---

## Step 14: Build!

```bash
struktur build -c classes/ -i instances/ -t templates/
```

**Expected output:**
```
Build Phase: Stack Loading & Validation
✓ Loaded 3 classes
✓ Loaded 3 instances
✓ Validation passed

Build Phase: Template Loading
✓ Loaded 3 templates

Build Phase: Rendering
✓ Rendered index.html
✓ Rendered posts/welcome.html (via render_file)
✓ Rendered posts/struktur-intro.html (via render_file)
✓ Rendered about.html (via render_file)

Build Phase: Finalization
✓ Build complete: build/build-8f3a29d1/

Build Output:
  build/build-8f3a29d1/
  ├── canonical.json
  ├── index.html
  ├── about.html
  └── posts/
      ├── welcome.html
      └── struktur-intro.html
```

---

## Step 15: View Your Blog

```bash
open build/build-*/index.html
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
- Context includes all instances, classes, buildContext

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
{{#each (reverse (sort_by (where instances "class" "post") "created_at"))}}
  <article>{{title}}</article>
{{/each}}
```

**3. Group by category:**
```handlebars
{{#each (group_by (where instances "class" "post") "category")}}
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
