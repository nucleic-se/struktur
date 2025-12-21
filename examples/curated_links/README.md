# Curated Links Example

A demonstration of **Struktur's schema and template reusability** across multiple collections.

## What This Demonstrates

This example showcases several powerful Struktur features:

1. **Schema reusability** - Only 3 schemas, all actively used:
   - `collection_metadata` - Collection metadata (title, description, url)
   - `link_base` - Base link properties (title, url, description, category)
   - `tool_link` - Extends link_base with tool-specific fields (github_stars, language, license)

2. **Multiple collections** - Same schemas/templates, different data:
   - JavaScript Build Tools (40 tools)
   - CSS Frameworks (40 frameworks)  
   - Testing Tools (40 tools)

3. **Template reusability** - Same 4 templates generate all formats for each collection:
   - `README.md` - GitHub-ready documentation with tables
   - `index.html` - Interactive web app with search, filters, and tags
   - `api.json` - JSON API for programmatic access
   - `feed.rss` - RSS feed for subscriptions

4. **Data modeling excellence** - Proper schemas, semantic naming, zero dead code
5. **Multiple instance sets** - Different `instances_*` folders with separate build configs
6. **Nunjucks templates** - Modern template engine with filters and conditionals
7. **Tag strategy** - 2 broad tags per item (~10 unique tags per collection)
8. **Class-based filtering** - Semantic type checking: `instance.$class == 'tool_link'`

## Quick Start

```bash
# Build all three collections
struktur build --config js_build_tools.build.json
struktur build --config css_frameworks.build.json
struktur build --config testing_tools.build.json

# View interactive HTML (any collection)
open build/js_build_tools/index.html
open build/css_frameworks/index.html
open build/testing_tools/index.html

# Check JSON API
cat build/css_frameworks/api.json | jq '.collection'
```

## File Structure

```
curated_links/
├── classes/                         # Schemas (shared by all collections)
│   ├── collection_metadata.class.json
│   ├── link_base.class.json       
│   └── tool_link.class.json       
├── templates/                       # Templates (shared by all collections)
│   ├── readme.md.njk               
│   ├── index.html.njk              
│   ├── api.json.njk                
│   └── feed.rss.njk                
├── instances/                       # All collections
│   ├── js_build_tools/              # JS collection (41 files)
│   │   ├── metadata.json                 
│   │   ├── link_001.json               
│   │   └── ...                         
│   ├── css_frameworks/              # CSS collection (41 files)
│   │   ├── metadata.json               
│   │   ├── css_001.json                
│   │   └── ...                         
│   └── testing_tools/               # Testing collection (41 files)
│       ├── metadata.json                 
│       ├── test_001.json               
│       └── ...                         
├── js_build_tools.build.json       # Build config
├── css_frameworks.build.json       # Build config
└── testing_tools.build.json        # Build config
```

**Key Point**: Same `classes/` and `templates/` are shared by all three collections. Only the `instances/*/` folders and build configs differ.
```

## Key Learnings

### Template Syntax (Nunjucks)
- Arrays: Use `.concat()` not `.append()` (Nunjucks ≠ Jinja2)
- Filtering: Filter before loop or use `{% if %}` inside loop
- JSON output: Manually build JSON to avoid trailing commas with `loop.last`

### Schema Design
- `$class` field at root level (not inside `schema` object)
- No `$schema` declarations needed
- Aspects: Simple `{$aspect, $schema}` structure

### Multi-format Output
- Same canonical data → multiple output formats
- Each template accesses: `$instances`, `$instances_by_id`, `$classes_by_id`
- Templates can filter, sort, group data independently

### Data Modeling
- **Proper schema for metadata**: `collection_metadata` schema instead of forcing into `link_base`
- **Semantic naming**: `metadata.json` with `$id: "metadata"` (not "global")
- **No dead code**: Only 3 schemas, all actively used (deleted unused article_link/resource_link)
- **Clean separation**: Metadata instance separate from link instances
- **Tag consolidation**: 2 broad tags per item instead of 5 verbose tags (reduces noise)

### Template Patterns

**Class-based filtering** (semantic, type-safe):
```nunjucks
{% for instance in $instances %}
  {% if instance.$class == 'tool_link' %}
    {# process link #}
  {% endif %}
{% endfor %}
```

**Counting with manual loop**:
```nunjucks
{% set count = 0 %}
{% for i in $instances %}
  {% if i.$class == 'tool_link' %}
    {% set count = count + 1 %}
  {% endif %}
{% endfor %}
{{ count }}
```

**Array building**:
```nunjucks
{% set links = [] %}
{% for i in $instances %}
  {% if i.$class == 'tool_link' %}
    {% set links = links.concat([i]) %}
  {% endif %}
{% endfor %}
```

**Tip**: Use `filter_inherits` to keep templates concise (no manual loops needed).

## Interactive Features (HTML)

- 🔍 **Search** - Filter by name or description
- 📂 **Category filter** - 12 categories (Bundlers, Linters, etc.)
- 🏷️ **Tag filter** - Click tags to filter (multiple selection)
- ⭐ **Metadata** - Stars, language, license displayed
- 📱 **Responsive** - Works on mobile and desktop

## API Format (JSON)

```json
{
  "collection": {
    "title": "...",
    "description": "...",
    "last_updated": "2025-12-19",
    "total_links": 40,
    "categories": [...]
  },
  "links": [
    {
      "$id": "link_001",
      "title": "Webpack",
      "url": "https://webpack.js.org",
      "description": "...",
      "category": "Bundlers",
      "github_stars": 64500,
      "language": "JavaScript",
      "license": "MIT",
      "tags": ["bundler", "module", "build-tool"]
    },
    ...
  ],
  "metadata": {
    "generated_by": "Struktur",
    "generated_at": "2025-12-19",
    "format_version": "1.0"
  }
}
```

## Known Limitations

1. **Metadata as instance** - Collection metadata (`metadata.json`) lives as an instance alongside links
   - Templates must filter: `{% if instance.$class == 'tool_link' %}`
   - Proper solution: Build config `metadata` field (see `task_build_config_metadata.md`)
   - Current approach is functional but not ideal architecture

2. **Template extensions** - Must specify `.njk` explicitly in build configs
  - Build config: `{"template": "index.html.njk", "output": "/index.html"}`
   - Auto-extension fallback is unreliable

## Extending This Example

### Add More Links
1. Create new instance file: `instances/js_build_tools/link_NNN.json`
2. Use `tool_link` schema with required fields
3. Add 2 broad tags (category + type)
4. Rebuild: `struktur build --config js_build_tools.build.json`

### Add New Collection
1. Create new instances folder: `instances/your_topic/`
2. Add metadata.json and link files
3. Create build config: `your_topic.build.json` pointing to new folder
4. Reuse same templates and schemas

### Add New Format
1. Create template: `templates/myformat.ext.njk`
2. Add to `render` object in build config: `{"myformat.ext.njk": "/output.ext"}`
3. Access same data: `$instances`, `$instances_by_id`, `$classes_by_id`
4. Filter links: `{% if instance.$class == 'tool_link' %}`



## Impact

This example demonstrates Struktur's value for:
- **Curation platforms** - Awesome lists, resource directories, tool comparisons
- **Documentation sites** - Multi-format docs from single source
- **Data distribution** - Web, API, RSS, PDF from canonical data

## Next Steps

Try building your own curated collection:
1. Define schemas for your domain
2. Create instance data for your content
3. Create templates for your target formats
4. Let Struktur handle validation and rendering

---

**Made with ⚡ [Struktur](https://github.com/nucleic-se/struktur)** - Build system for coordinated configuration
