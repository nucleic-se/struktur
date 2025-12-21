# Skribe: Static Site Generator

A complete static site generator built with Struktur, demonstrating structured data, inheritance, multi-file outputs, dynamic tag pages, and composable theming.

## Design Philosophy

This stack is **opinionated and minimal**:

✅ **One obvious way** to structure content in Struktur  
✅ **Minimal viable blog** (not a CMS replacement)  
✅ **Best practices** baked in (structured content, schema validation, deterministic builds)  
✅ **Clear extension points** (mixins for RSS, dark theme)

**Not included:**
- Complex CMS features (comments, auth, admin UI)
- Production optimization (minification, CDN, etc.)
- Theme customization system

**Use this as:**
- **Learning reference** (structured content patterns)
- **Blog starter** (fork and write posts)
- **Static site pattern** (adapt for docs, portfolios, etc.)

**Don't expect:**
- WordPress-level features
- Theme marketplace
- Real-time updates

## Features

- **Blog posts with tags**: 16 example posts across 4 tag categories
- **Static pages**: About, Contact, Privacy with flexible menu placement
- **Tag index pages**: Automatically generated from post tags
- **RSS feed mixin**: Optional RSS 2.0 feed generation
- **Dark theme mixin**: Optional dark color scheme via CSS cascade
- **Responsive design**: Clean, readable layout with CSS custom properties
- **Deterministic builds**: Same inputs always produce identical outputs

## Quick Start

Install Struktur:
```bash
npm install -g @nucleic-se/struktur@alpha
```

Create a new site:
```bash
struktur init --example skribe my-blog
cd my-blog
```

Build the site (uses `struktur.build.json` config):
```bash
struktur build --exact
```

The config includes RSS feed and dark theme by default.

Build without mixins (base only):
```bash
struktur build -i instances -t templates
```

CLI flags override the config file.

Open `build/index.html` in your browser.

## Structure

```
skribe/
  aspects/              # Aspect type definitions
    blog_post.aspect.json     # Blog post fields: date, content, author, tags
    page.aspect.json          # Page fields: content, menu placement
  classes/              # Content type definitions
    content_base.class.json  # Shared: title, slug, description
    blog_post.class.json     # Extends content_base, uses blog_post aspect
    page.class.json          # Extends content_base, uses page aspect
  instances/            # Content organized by type
    posts/              # 16 blog posts
      welcome.json
      getting-started.json
      ...               # 14 more posts
    pages/              # 4 static pages
      about.json        # Page with menu: "both"
      contact.json
      privacy.json
      guide.json
    global.json         # Site config, stylesheet array, build manifest
  templates/
    index.html          # Homepage: lists posts, generates all pages via render_file
    blog-post.html      # Individual post layout
    page.html           # Static page layout
    tag.html            # Tag index page layout
    css/                # Stylesheets
      style.css         # Base styles
      custom.css        # Theme variables (CSS custom properties)
    layouts/            # HTML layouts (html/body tags)
      base.html         # Base layout with head/body structure
    partials/           # Reusable components
      nav.html          # Navigation with menu items
      footer.html       # Footer links
      tags.html         # Tag list component
  mixins/
    rss/                # Optional RSS feed
      instances/rss_feed.json
      templates/feed.xml
    dark-theme/         # Optional dark color scheme
      instances/global.json        # Adds css/dark-theme.css to stylesheets array
      templates/css/dark-theme.css # Dark theme CSS overrides
```

## What Skribe Demonstrates

### Core Struktur Features

**Class inheritance + aspects**: All content types extend `content_base` and declare aspect types
```json
{
  "$class": "blog_post",
  "$parent": "content_base",
  "$uses_aspects": ["blog_post"],
  "$aspect_defaults": {
    "blog_post": {
      "author": "Struktur Team"
    }
  }
}
```

**Aspect defaults for DRY configuration**: Class-level defaults eliminate duplication
- All 16 blog posts inherit `"author": "Struktur Team"` from class definition
- Instances only specify author if different from default
- Single source of truth—change once, applies everywhere
- Same pattern used in `docked` and `backbone` examples for infrastructure

**Schema validation**: Required fields enforced at build time
```json
{
  "required": ["$id", "$class", "title", "slug"],
  "properties": {
    "date": { "type": "string", "minLength": 1 }
  }
}
```

**Template partials**: Shared components eliminate duplication
```handlebars
{{> partials/head pageTitle=title pathPrefix=pathPrefix}}
{{> partials/tags pathPrefix=pathPrefix}}
```

**Multi-file rendering**: Generate pages dynamically via render_file helper
```handlebars
{{#each $instances}}
{{#if (eq $class "blog_post")}}
{{render_file "blog-post" (concat "posts/" slug ".html")}}
{{/if}}
{{/each}}
```

**Additive composition**: Mixins extend functionality without overrides
```bash
struktur build base mixin1 mixin2  # Later sources merge into earlier
```

**Array-based extensibility**: Global stylesheets array allows dynamic CSS inclusion
```json
{
  "stylesheets": ["css/style.css", "css/custom.css"]  // Mixins can add more
}
```

### Advanced Patterns

**CSS custom properties for theming**: Light theme in base, dark theme overlays via cascade
```css
/* css/custom.css - base light theme */
:root {
  --bg-primary: #ffffff;
  --text-primary: #333333;
}

/* css/dark-theme.css - mixin override */
:root {
  --bg-primary: #1a1a1a;
  --text-primary: #e0e0e0;
}
```

**Path-relative partials**: Partials handle different directory depths
```handlebars
{{> partials/head pathPrefix="../"}}  <!-- From posts/ subdirectory -->
{{> partials/head}}                   <!-- From root -->
```

**Menu placement control**: Pages specify where they appear via page aspect
```json
{
  "$aspects": {
    "page": {
      "menu": "header"  // Options: "header", "footer", "both", "none"
    }
  }
}
```

**Tag taxonomy**: Broad categories instead of micro-tags
```json
{
  "tags": ["tutorial", "best-practices"]  // 4 total tags across 16 posts
}
```

## Build Output

Running `struktur build . --build-dir build` generates:

**22 HTML pages**:
- `index.html` - Homepage with recent posts
- `posts/*.html` - 16 individual blog posts
- `about.html`, `contact.html`, `privacy.html` - Static pages
- `tags/*.html` - 4 tag index pages (tutorial, best-practices, concepts, advanced)

**3 CSS files**:
- `css/style.css` - Base layout and typography
- `css/custom.css` - Theme variables (colors, spacing)
- `css/dark-theme.css` - Only when built with dark-theme mixin

**1 XML feed** (with RSS mixin):
- `feed.xml` - RSS 2.0 feed of blog posts

## Customization

### Add a blog post

Create `instances/posts/my-post.json`:
```json
{
  "$id": "my-post",
  "$class": "blog_post",
  "title": "My First Post",
  "slug": "my-first-post",
  "description": "A short description for listings and RSS",
  "$aspects": {
    "blog_post": {
      "date": "2025-12-14",
      "author": "Your Name",
      "tags": ["tutorial"],
      "content": "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    }
  }
}
```

**Note**: Author defaults to "Struktur Team" (from class `$aspect_defaults`). Only specify if different.

**Note**: Use `\n\n` to separate paragraphs. The template converts these to `</p><p>` tags.

### Add a static page

Create `instances/pages/team.json`:
```json
{
  "$id": "team",
  "$class": "page",
  "title": "Our Team",
  "slug": "team",
  "$aspects": {
    "page": {
      "menu": "header",
      "content": "Meet the team..."
    }
  }
}
```

### Create a new tag

Just add it to a post's `tags` array in the blog_post aspect. Tag pages generate automatically:
```json
{
  "$aspects": {
    "blog_post": {
      "tags": ["tutorial", "my-new-tag"]
    }
  }
}
```

### Customize colors

Edit `templates/css/custom.css`:
```css
:root {
  --bg-primary: #f8f9fa;      /* Light gray background */
  --link-color: #e74c3c;      /* Red links */
  /* ...more variables... */
}
```

### Add a new content type

**Best Practice**: Define aspect first (data structure), then class (ties aspect to content_base hierarchy).

1. Create `aspects/tutorial.aspect.json` (defines tutorial-specific fields):
```json
{
  "aspect": "tutorial",
  "difficulty": "beginner",
  "duration": "30min",
  "prerequisites": [],
  "$schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["difficulty"],
    "properties": {
      "difficulty": { 
        "type": "string", 
        "enum": ["beginner", "intermediate", "advanced"] 
      },
      "duration": { "type": "string" },
      "prerequisites": { 
        "type": "array", 
        "items": { "type": "string" }
      }
    }
  }
}
```

2. Create `classes/tutorial.class.json` (extends content_base, uses tutorial aspect):
```json
{
  "$class": "tutorial",
  "$parent": "content_base",
  "$uses_aspects": ["tutorial"],
  "$aspect_defaults": {
    "tutorial": {
      "difficulty": "beginner",
      "duration": "30 minutes"
    }
  },
  "$schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {},
    "additionalProperties": true
  }
}
```

3. Create instance `instances/tutorials/first-tutorial.json`:
```json
{
  "$id": "first-tutorial",
  "$class": "tutorial",
  "title": "Getting Started Tutorial",
  "slug": "getting-started-tutorial",
  "description": "Learn the basics",
  "$aspects": {
    "tutorial": {
      "difficulty": "beginner",
      "prerequisites": ["Basic HTML knowledge"]
      // duration inherited from $aspect_defaults
    }
  }
}
```

4. Create template `templates/layouts/tutorial.html`:
```handlebars
<!DOCTYPE html>
<html lang="en">
{{> partials/head pageTitle=title pathPrefix=pathPrefix}}
<body>
  {{> partials/nav pathPrefix=pathPrefix}}
  <article>
    <h1>{{title}}</h1>
    <div class="tutorial-meta">
      Difficulty: {{$aspects.tutorial.difficulty}} | 
      Duration: {{$aspects.tutorial.duration}}
    </div>
    {{#if $aspects.tutorial.prerequisites}}
    <div class="prerequisites">
      <h3>Prerequisites</h3>
      <ul>
        {{#each $aspects.tutorial.prerequisites}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
    {{/if}}
  </article>
  {{> partials/footer pathPrefix=pathPrefix}}
</body>
</html>
```

5. Update `templates/index.html` to render tutorials:
```handlebars
{{#each $instances}}
{{#if (eq $class "tutorial")}}
{{render_file "layouts/tutorial" (concat "tutorials/" slug ".html") pathPrefix="../"}}
{{/if}}
{{/each}}
```

**Key Design Principles**:
- **Aspects define data structure** - field names, types, validation
- **Classes define inheritance** - parent relationships, aspect composition
- **$aspect_defaults eliminate duplication** - common values defined once
- **Instances provide unique data** - only what differs from defaults

## Mixin System

Skribe demonstrates **additive composition**—mixins extend the base without modifying it.

### RSS Mixin

Adds RSS 2.0 feed generation:
- **Source**: `mixins/rss/`
- **What it does**: Adds `rss_feed` instance and `feed.xml` template
- **Output**: `/feed.xml` with 20 most recent posts
- **Usage**: `struktur build . mixins/rss --build-dir build`

Configure feed in `mixins/rss/instances/rss_feed.json`:
```json
{
  "title": "My Blog",
  "link": "https://example.com",
  "description": "Blog description",
  "language": "en-us",
  "max_items": 20
}
```

### Dark Theme Mixin

Adds dark color scheme via CSS cascade:
- **Source**: `mixins/dark-theme/`
- **What it does**: Adds `css/dark-theme.css` to global stylesheets array
- **How it works**: CSS loaded after `css/custom.css`, overrides via cascade (no template replacement)
- **Usage**: `struktur build . mixins/dark-theme --build-dir build`

This demonstrates **array-based extensibility**—mixins add items to arrays rather than replacing files.

## Template Helpers

Skribe uses Struktur's built-in Handlebars helpers:

**Core Helpers** (domain-agnostic):
- **`render_file`** - Generate separate output file from partial
- **`concat`** - Join strings for dynamic paths
- **`replace`** - String replacement
- **`eq`, `or`** - Logic comparisons
- **`json`** - Output JSON (for debugging)

**Collection Helpers**:
- **`sort_by`** - Sort array by field: `{{#each (sort_by $instances "date")}}`
- **`where_includes`** - Filter array where field includes value
- **`filterList`** - Filter array by custom logic
- **`length`** - Get array length

Example - Generate post pages:
```handlebars
{{#each $instances}}
{{#if (eq $class "blog_post")}}
{{render_file "blog-post" (concat "posts/" slug ".html")}}
{{/if}}
{{/each}}
```

Example - Filter and sort posts:
```handlebars
{{#each (sort_by (filterList $instances class="blog_post") "$aspects.blog_post.date")}}
  <article>
    <h2>{{title}}</h2>
    <time>{{$aspects.blog_post.date}}</time>
  </article>
{{/each}}
```

## Why Struktur for Static Sites?

**Type safety**: Schemas catch errors before deployment
- Missing required fields → build fails
- Invalid enum values → build fails
- Extra fields → warnings (can be errors)

**Reusable structure**: Content types share common fields via inheritance
- `content_base` defines title, slug, content, author
- `blog_post` extends with date (required) and tags
- `page` extends with menu placement

**Clean separation**: Data, structure, and presentation are decoupled
- **Data**: Instances in JSON files
- **Structure**: Classes define shapes and validation
- **Presentation**: Templates render HTML/XML/CSS

**Deterministic builds**: Builds are reproducible and comparable
- Same inputs → identical outputs (byte-for-byte)
- Build directory named by source hash → prevents overwrites
- Diff builds to see exactly what changed

**Composable architecture**: Stack features through layering, not forking
- Base provides foundation (posts, pages, tags)
- Mixins add features (RSS, dark theme)
- No merge conflicts, no fragile patches

**No runtime dependencies**: Pure static output
- No JavaScript framework required
- No server-side processing
- Deploy to any static host (Netlify, Vercel, GitHub Pages, S3, etc.)

## Comparison to Other Static Site Generators

**vs Jekyll/Hugo**: More structure, less magic
- Struktur: Explicit schemas, predictable merging, composable stacks
- Jekyll/Hugo: Convention-based, opaque builds, plugin systems

**vs Gatsby/Next.js**: Build-time only, no client bundle
- Struktur: Pure HTML generation, zero JavaScript
- Gatsby/Next: React hydration, large client bundles

**vs Eleventy**: Structured data model vs free-form
- Struktur: JSON Schema validation, class inheritance, deterministic merging
- Eleventy: Flexible data sources, template-driven, convention-based

**Struktur's niche**: Sites where **data integrity** and **build reproducibility** matter more than rich interactivity. Think documentation sites, blogs, portfolios, knowledge bases—content that benefits from validation and versioning.

## Performance

Skribe builds are fast:
- **16 blog posts + 4 pages + 4 tag pages**: ~100ms
- **With RSS mixin**: ~110ms
- **With dark theme**: ~105ms
- **All together**: ~120ms

Struktur's performance comes from:
- Single-pass merging (no file re-reads)
- Efficient template caching
- Minimal dependency tree
- No filesystem watch overhead (build once, deploy)

## Deployment

Build outputs are static HTML—deploy anywhere:

**Netlify**:
```toml
[build]
  command = "struktur build . --build-dir dist"
  publish = "dist"
```

**Vercel** (vercel.json):
```json
{
  "buildCommand": "struktur build . --build-dir dist",
  "outputDirectory": "dist"
}
```

**GitHub Pages**:
```yaml
- name: Build site
  run: |
    npm install -g @nucleic-se/struktur@alpha
    struktur build . --build-dir _site
- name: Deploy
  uses: peaceiris/actions-gh-pages@v3
  with:
    publish_dir: ./_site
```

**AWS S3**:
```bash
struktur build . --build-dir dist
aws s3 sync dist/ s3://my-bucket/ --delete
```

## Development Workflow

**1. Edit content**: Modify instances, add posts, update pages

**2. Rebuild**: `struktur build . --build-dir build`

**3. Preview**: Open `build/index.html` (or use `python -m http.server` in build/)

**4. Validate**: Check `build/meta/validation.json` for warnings

**5. Inspect**: Review `build/canonical.json` to see merged data

**6. Compare**: Diff builds to verify changes

**7. Deploy**: Push static files to host

## Troubleshooting

**Build fails with validation error**: Check `build/meta/validation.json` for details
```bash
struktur build . --build-dir build  # Validation runs automatically
```

**Missing stylesheet**: Verify `global.stylesheets` array includes it
```json
{
  "stylesheets": ["css/style.css", "css/custom.css"]
}
```

**Tag page not generating**: Ensure tag is in at least one post's `tags` array

**Post not showing**: Verify `$class: "blog_post"` and required fields ($id, title, slug, date)

**Path issues in nested pages**: Check `pathPrefix` parameter passed to partials

**Template not found**: Ensure template exists in `templates/` directory

## Learning Resources

**Struktur docs**: See main Struktur repository for:
- Design philosophy
- Best practices
- Template helper reference
- Schema compatibility rules

**Skribe as example**: This stack demonstrates:
- Clean separation of concerns
- Reusable partials and layouts
- Dynamic data querying
- Additive mixin composition
- CSS theming patterns
- Multi-file output generation

**Extending Skribe**: Use this as a foundation for:
- Corporate blogs with author profiles
- Documentation sites with version tags
- Portfolio sites with project types
- Knowledge bases with category hierarchy
- Multi-language sites with locale handling
