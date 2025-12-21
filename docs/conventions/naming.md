# Naming Conventions

Struktur uses explicit naming conventions to separate system fields from user data and to keep templates predictable.

## System Fields

**Rule:** System/meta fields always use a `$` prefix and snake_case.

Examples:
- `$class`, `$parent`, `$schema`
- `$uses_aspects`, `$aspect_defaults`
- `$aspects`, `$render`, `$metadata`

User data fields never use `$`. If it is user data, keep it unprefixed.

## Class Names

**Rule:** `snake_case`.

Common prefixes:
- `aspect_*` for aspect definitions (e.g. `aspect_infrastructure`)
- `domain_*` for domain classes (e.g. `domain_network`)

**Choosing prefixes:**
- Use `aspect_*` for cross-cutting traits (logging, monitoring, networking).
- Use `domain_*` for system layer groupings (infrastructure, application).
- Use no prefix for regular classes (e.g. `server`, `blog_post`).

**Edge cases and acronyms:**
- `URLParser` → `url_parser`
- `APIClient` → `api_client`
- `JSONSchema` → `json_schema`
- `XMLHttpRequest` → `xml_http_request`
- `PostgreSQL` → `postgresql`
- `NginxConfig` → `nginx_config`

## File Names

**Rule:** `snake_case.class.json` and the filename must match `$class`.

Examples:
- `blog_post.class.json` → `"$class": "blog_post"`
- `aspect_network_interface.class.json` → `"$class": "aspect_network_interface"`

**Legacy:** `.aspect.json` is still supported but deprecated. Use `.class.json` for new aspects.

## Instance Files

**Rule:** Any descriptive name is OK. Instance IDs may use kebab-case.

Examples:
- `server-prod-01.json`
- `metadata.json`

## Template Helpers

**Rule:** Helper names are **snake_case only**.

Struktur helpers:
- `inherits`, `class_lineage`, `filter_inherits`
- `schema_required`, `schema_has`, `schema_props`
- `schema_prop_source`, `schema_required_by_source`

Generic helpers:
- `where`, `where_includes`, `sort_by`, `group_by`, `pluck`
- `title_case`, `default_value`, `is_array`, `type_of`

If you see camelCase in templates, rename it.

**Common mistakes:**
- `sortBy` → `sort_by`
- `whereIncludes` → `where_includes`
- `default` → `default_value`
- `classLineage` → `class_lineage`

If a helper is not found, check for camelCase usage first.

## JavaScript Code (Internal)

Standard JavaScript conventions apply:
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

These apply to internal code only. Template helper names are snake_case.
