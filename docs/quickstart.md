# Quickstart

Get from zero to your first Struktur build in 5 minutes.

## Prerequisites

- Node.js v20 or higher
- npm or yarn

## Installation

```bash
npm install -g @nucleic-se/struktur@alpha
```

Verify installation:
```bash
struktur --version
# Should show: 0.2.3-alpha (or newer)
```

## Initialize Universal Base

Universal provides foundational classes that most stacks extend.

```bash
struktur init universal
cd universal
```

**What you get:**
```
universal/
├── classes/
│   ├── entity_base.json          # Root class
│   ├── entity_base.schema.json   # Base schema
│   ├── aspect_base.json           # Aspect root
│   └── domain_root.json           # Domain container
├── instances/
│   └── .gitkeep
└── templates/
    └── viewer.html.hbs            # Hierarchical viewer
```

## Inspect Classes

```bash
struktur info -c classes/
```

**Output:**
```
Classes loaded: 3

entity_base
  parent: (none)
  schema: entity_base.schema.json
  
aspect_base
  parent: entity_base
  schema: aspect_base.schema.json
  
domain_root
  parent: entity_base
  schema: domain_root.schema.json
```

## Create Your First Instance

```bash
mkdir -p instances
cat > instances/my-domain.json <<EOF
{
  "id": "engineering",
  "class": "domain_root",
  "name": "Engineering",
  "description": "Engineering department"
}
EOF
```

## Validate

```bash
struktur validate .
```

**Success output:**
```
✓ Loaded 3 classes
✓ Loaded 1 instance
✓ Validation passed
  - engineering (domain_root)
```

## Build

```bash
struktur build .
```

**Output:**
```
Build Phase: Stack Loading & Validation
✓ Loaded 3 classes
✓ Loaded 1 instance
✓ Validation passed

Build Phase: Template Loading
✓ Loaded 1 template (viewer.html.hbs)

Build Phase: Rendering
✓ Rendered viewer.html

Build Phase: Finalization
✓ Build complete: build/build-a3f7c812/

Build Output:
  build/build-a3f7c812/
  ├── canonical.json    # Validated data
  └── viewer.html       # Interactive tree view
```

## View Result

```bash
open build/build-*/viewer.html
```

**You'll see:** Interactive hierarchical tree viewer with your domain instance.

---

## Next Steps

### Add More Instances

```bash
cat > instances/web-team.json <<EOF
{
  "id": "web-team",
  "class": "entity_base",
  "name": "Web Team",
  "description": "Frontend and backend developers",
  "domain": "@engineering"
}
EOF

struktur validate . && struktur build .
```

### Explore Examples

```bash
# Docker container demo
struktur init --example docked my-containers
cd my-containers
struktur build .

# Static site generator
struktur init --example skribe my-site
cd my-site
struktur build .
```

### Build Your Own Stack

Create a custom stack extending Universal:

```bash
mkdir mystack && cd mystack

# Reference universal classes
cat > struktur.build.json <<EOF
{
  "classes": ["../universal/classes", "./classes"],
  "instances": ["./instances"],
  "templates": ["./templates"]
}
EOF

# Create custom class
mkdir -p classes
cat > classes/blog_post.json <<EOF
{
  "class": "blog_post",
  "parent": "entity_base",
  "author": "Anonymous",
  "status": "draft"
}
EOF

cat > classes/blog_post.schema.json <<EOF
{
  "\$schema": "http://json-schema.org/draft-07/schema#",
  "class": "blog_post",
  "type": "object",
  "properties": {
    "title": {"type": "string"},
    "author": {"type": "string"},
    "content": {"type": "string"},
    "status": {"type": "string", "enum": ["draft", "published"]}
  },
  "required": ["title", "content"]
}
EOF

# Create instance
mkdir -p instances
cat > instances/welcome.json <<EOF
{
  "id": "welcome-post",
  "class": "blog_post",
  "title": "Welcome to My Blog",
  "content": "This is my first post!",
  "author": "Alice",
  "status": "published"
}
EOF

# Create template
mkdir -p templates
cat > templates/posts.html.hbs <<EOF
<!DOCTYPE html>
<html>
<head><title>Blog Posts</title></head>
<body>
  <h1>Blog Posts</h1>
  {{#each (where instances "class" "blog_post")}}
    <article>
      <h2>{{title}}</h2>
      <p>By {{author}} - {{status}}</p>
      <div>{{content}}</div>
    </article>
  {{/each}}
</body>
</html>
EOF

# Validate and build
struktur validate .
struktur build .
open build/build-*/posts.html
```

**Success!** You've created a custom class, validated instances, and rendered templates.

---

## Common Commands

```bash
# Validate without building
struktur validate mystack

# Build with specific directories
struktur build -c classes/ -i instances/ -t templates/

# Layer multiple stacks
struktur build universal mystack

# Generate canonical.json only (no templates)
struktur generate mystack -o data.json

# JSON output for scripting
struktur validate mystack --json
```

---

## Troubleshooting

### Command not found

```bash
# Check installation
npm list -g @nucleic-se/struktur

# Reinstall
npm install -g @nucleic-se/struktur@alpha
```

### Validation fails

```bash
# See detailed errors
struktur validate . --json | jq .

# Check class definitions
struktur info -c classes/
```

### Build fails

```bash
# Validate first
struktur validate .

# Check paths
ls classes/ instances/ templates/

# See errors-troubleshooting.md for common issues
```

---

## Learn More

- **[Tutorial: First Stack](tutorial-first-stack.md)** - Build a blog from scratch (20 minutes)
- **[Tutorial: Extending Universal](tutorial-extending-universal.md)** - Use inheritance and aspects
- **[CLI Reference](cli-reference.md)** - All commands and flags
- **[Helper Reference](helpers-reference.md)** - Template helpers
- **[Concepts](INDEX.md#core-concepts)** - Deep dives into architecture

---

## What Just Happened?

1. **Installed Struktur** - Global CLI tool
2. **Initialized Universal** - Base classes (entity_base, aspect_base, domain_root)
3. **Created Instance** - JSON file with `id`, `class`, `name`
4. **Validated** - Checked instance against schema
5. **Built** - Merged data, validated, rendered templates
6. **Viewed Output** - Interactive HTML viewer

**Key Concepts:**
- **Classes** define structure and defaults
- **Schemas** enforce validation rules
- **Instances** provide actual data
- **Templates** render outputs
- **Build** runs 4-phase pipeline: Load → Merge → Validate → Render

Ready to dive deeper? Start with the [First Stack Tutorial](tutorial-first-stack.md)!
