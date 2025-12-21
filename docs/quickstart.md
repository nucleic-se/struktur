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
# Should show: 0.2.6-alpha (or newer)
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
│   ├── entity_base.class.json   # Entity class with schema
│   ├── global.class.json         # Global config class
│   ├── universal_base.class.json # Root base class
│   └── domains/
│       └── domain_root.class.json  # Domain container class
├── instances/
│   └── global.json                # Global instance
└── templates/
    └── viewer.html                # Hierarchical viewer
```

## Inspect Classes

```bash
struktur info -c classes/
```

**Output:**
```
=== Classes ===
  domain_root (inherits: universal_base)
  entity_base (inherits: universal_base)
  global (inherits: none)
  universal_base (inherits: none)

Total: 4 classes
```

## Create Your First Instance

```bash
mkdir -p instances
cat > instances/my-domain.json <<EOF
{
  "$id": "engineering",
  "$class": "domain_root",
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
=== Validation Results ===

✓ global (global)
✓ engineering (domain_root)

=== Summary ===
Total:    2
Valid:    2
Invalid:  0
Errors:   0
```

## Build

```bash
struktur build . --exact
```

**Output:**
```
📦 Loading stack...
  ✓ Loaded 4 classes
  ✓ Loaded 0 aspects
  ✓ Loaded 2 instances

🔍 Validating stack...
  ✓ All 2 class-bearing instances valid

📁 Preparing build directory: ./build

📝 Writing outputs...
  ✓ canonical.json (2 instances)
  ✓ meta/classes/ (4 classes)
  ✓ meta/validation.json

🎨 Rendering templates...
  Found 1 build tasks
  ✓ 1 files rendered

✨ Build complete!
  📊 2 instances validated
  📦 4 class definitions
  🎨 1 templates rendered
  📂 ./build/

✨ Open ./build/index.html to view your stack

Build Output:
  build/
  ├── .struktur-manifest.json
  ├── canonical.json       # Validated data
  ├── index.html           # Interactive tree view
  └── meta/
      ├── classes/         # Class definitions
      └── validation.json
```

## View Result

```bash
open build/index.html
```

**You'll see:** Interactive hierarchical tree viewer with your domain instance.

---

## Next Steps

### Add More Instances

```bash
cat > instances/web-team.json <<EOF
{
  "$id": "web-team",
  "$class": "entity_base",
  "name": "Web Team",
  "description": "Frontend and backend developers",
  "domains": ["engineering"]
}
EOF

struktur validate . && struktur build . --exact
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

Create a custom stack with blog post content:

```bash
mkdir mystack && cd mystack
mkdir -p classes instances templates

# Create global class and instance (needed for build tasks)
cat > classes/global.class.json <<EOF
{
  "$class": "global",
  "$schema": {
    "\$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "$id": {"type": "string"},
      "$class": {"type": "string"},
      "description": {"type": "string"},
      "$render": {"type": "array"}
    }
  }
}
EOF

cat > instances/global.json <<EOF
{
  "$id": "global",
  "$class": "global",
  "description": "Blog configuration",
  "$render": [
    {
      "template": "posts.html",
      "output": "/posts.html"
    }
  ]
}
EOF

# Create custom blog_post class
cat > classes/blog_post.class.json <<EOF
{
  "$class": "blog_post",
  "$fields": {
    "title": "",
    "content": "",
    "author": "Anonymous",
    "status": "draft"
  },
  "$schema": {
    "\$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["$id", "$class", "title", "content"],
    "properties": {
      "$id": {"type": "string"},
      "$class": {"type": "string"},
      "title": {"type": "string"},
      "author": {"type": "string"},
      "content": {"type": "string"},
      "status": {"type": "string", "enum": ["draft", "published"]}
    }
  }
}
EOF

# Create blog post instance
cat > instances/welcome.json <<EOF
{
  "$id": "welcome-post",
  "$class": "blog_post",
  "title": "Welcome to My Blog",
  "content": "This is my first post!",
  "author": "Alice",
  "status": "published",
  "description": "First blog post"
}
EOF

# Create template (Note: no .hbs extension - any filename works!)
cat > templates/posts.html <<EOF
<!DOCTYPE html>
<html>
<head><title>Blog Posts</title></head>
<body>
  <h1>Blog Posts</h1>
  {{#each (where $instances "$class" "blog_post")}}
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
struktur build . --exact
open build/posts.html
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
3. **Created Instance** - JSON file with `$id`, `$class`, `name`
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
