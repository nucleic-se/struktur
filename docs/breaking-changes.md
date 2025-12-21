# Breaking Changes

This document tracks breaking changes in Struktur's alpha releases.

> ⚠️ **Alpha Software**: Breaking changes are expected before 1.0. We document them here to help with migration.

---

## v0.3.0-alpha (In Progress - December 2025)

**Status**: Feature branch `feature_v0.3.0`, not yet tagged  
**Current package.json**: `0.2.14-alpha`  
**Base commits**: f61d3fc → a5dbf2b (4 breaking changes)

### System Property Prefix (`$`) for Data Model

**Breaking** (Commit: f61d3fc): All system/meta fields in instances, classes, aspects, and canonical now use `$` prefixes.

**Instances:**
- `id` → `$id`
- `class` → `$class`
- `render` → `$render`
- `aspects` → `$aspects`

**Classes:**
- `class` → `$class`
- `parent` → `$parent`
- `schema` → `$schema`
- `fields` → `$fields`
- `aspect_defaults` → `$aspect_defaults`
- `aspect_types` → `$uses_aspects`

**Aspects:**
- `aspect` → `$aspect`
- `schema` → `$schema`
- defaults now live under `$defaults`

**Canonical Output:**
- `instances` → `$instances`
- `instances_by_id` → `$instances_by_id`
- `classes` → `$classes`
- `classes_by_id` → `$classes_by_id`
- `aspects` → `$aspects`
- `aspects_by_id` → `$aspects_by_id`
- `metadata` → `$metadata`
- `validation` → `$validation`

**Templates:**
```handlebars
<!-- Before -->
{{id}} {{class}} {{aspects.page.menu}}

<!-- After -->
{{$id}} {{$class}} {{$aspects.aspect_page.menu}}
```

**Migration**:
- Update all instance files: `id` → `$id`, `class` → `$class`
- Update all class files: add `$` prefix to system fields
- Update all aspect files: add `$` prefix, move defaults under `$defaults`
- Update all templates to access fields with `$` prefix
- Update any code parsing canonical.json to use `$`-prefixed field names

**Rationale**: Clear separation between system fields and user-defined properties. Schema `properties` describe user data (unprefixed), system fields use `$` prefix.

---

### Template Helpers Normalized to snake_case

**Breaking** (Commit: 7485318): All template helper names are now snake_case only. No camelCase aliases.

**Struktur helpers (before → after):**
- `schemaRequired` → `schema_required`
- `schemaHas` → `schema_has`
- `schemaProps` → `schema_props`
- `schemaPropSource` → `schema_prop_source`
- `schemaRequiredBySource` → `schema_required_by_source`
- `classLineage` → `class_lineage`
- `filterInherits` → `filter_inherits`

**Generic helper examples (before → after):**
- `whereIncludes` → `where_includes`
- `sortBy` → `sort_by`
- `groupBy` → `group_by`
- `titleCase` → `title_case`
- `defaultTo` → `default_value`
- `isArray` → `is_array`
- `typeOf` → `type_of`

**Migration**:
- Update all templates to use snake_case helper names
- Find-replace camelCase → snake_case (mechanical, safe)
- See `docs/conventions/naming.md` for complete list and edge cases

**Rationale**: One naming convention across all helpers reduces confusion and matches template conventions. Clean break in alpha (no backward compatibility).

---

### Aspect Files Now Use `.class.json` (Not Yet Implemented)

**Breaking** (Planned for v0.3.0): Aspect definitions will use `.class.json` files. The `.aspect.json` format will be removed.

**Changes:**
- File extension: `*.aspect.json` → `*.class.json`
- Aspect definitions require `$class` field (must match `$aspect`)
- Aspect loader will only scan `.class.json` files
- No fallback support for `.aspect.json`

**Before:**
```json
// aspect_web_service.aspect.json
{
  "$aspect": "aspect_web_service",
  "$schema": { "type": "object", "properties": { "port": { "type": "number" } } },
  "$defaults": { "port": 8080 }
}
```

**After:**
```json
// aspect_web_service.class.json
{
  "$class": "aspect_web_service",
  "$aspect": "aspect_web_service",
  "$schema": { "type": "object", "properties": { "port": { "type": "number" } } },
  "$defaults": { "port": 8080 }
}
```

**Migration**:
1. Rename files: `aspect_foo.aspect.json` → `aspect_foo.class.json`
2. Add `"$class": "aspect_foo"` to match `"$aspect": "aspect_foo"`
3. Structure unchanged (keep `$aspect`, `$schema`, `$defaults`)

**Rationale**: One file extension (`.class.json`) for all definitions. Simplifies loader, removes legacy code path. Clean architecture for v1.0

---

### `$render` Format Strictly Enforced

**Breaking** (Commit: 953be59): `$render` tasks must be objects with `template` and `output` fields. Invalid formats now cause build failures.

**Before** (was normalized silently):
```json
{
  "$render": [
    { "index.html": "/index.html" }
  ]
}
```

**After** (required):
```json
{
  "$render": [
    { "template": "index.html", "output": "/index.html" }
  ]
}
```

**Migration**: Convert all render tasks to explicit `{template, output}` format. Validation happens at load time (instances and config files).

**Rationale**: Explicit format prevents silent failures, clearer error messages, no magic normalization.

---

### Instances No Longer Auto-Populate `$uses_aspects`

**Breaking** (Commit: 8794044): Instances no longer automatically populate `$uses_aspects` field. Classes still accumulate `$uses_aspects` through inheritance.

**Before**:
```json
// Instance had $uses_aspects auto-populated from class
{
  "$id": "web-01",
  "$class": "server",
  "$uses_aspects": ["infrastructure", "compute_node"]  // Auto-added
}
```

**After**:
```json
// Instance only has $aspects (actual merged data)
{
  "$id": "web-01",
  "$class": "server",
  "$aspects": {
    "aspect_infrastructure": { ... },
    "aspect_compute_node": { ... }
  }
}
```

**Templates - Use `$aspects` Keys** (recommended):
```handlebars
{{#each (keys $aspects)}}
  Aspect: {{this}}
{{/each}}
```

**Templates - Fallback** (if `$uses_aspects` explicitly declared):
```javascript
const aspectNames = Object.keys(obj.$aspects || {});
const declared = Array.isArray(obj.$uses_aspects) ? obj.$uses_aspects : [];
const display = aspectNames.length > 0 ? aspectNames : declared;
```

**Migration**: 
- Templates: Change `{{#each $uses_aspects}}` to `{{#each (keys $aspects)}}`
- Use actual merged data (`$aspects`) instead of declared list
- If you need the declared list, classes still have `$uses_aspects`

**Rationale**: Explicit over implicit. `$aspects` contains actual data, no redundant auto-population needed.

---

### Deterministic Builds Default to Enabled

**Breaking** (Commit: a5dbf2b): Deterministic (hash-based) build directories are now the default.

**Before**:
```bash
struktur build mystack
# Output: ./build/
```

**After**:
```bash
struktur build mystack
# Output: ./build/build-a1b2c3d4/
```

**Migration Options**:

**Option 1: Use new default (recommended)**
```bash
struktur build mystack
# Creates: ./build/build-<hash>/
```

**Option 2: Keep old behavior (opt-out)**
```bash
struktur build mystack --no-deterministic
# Creates: ./build/ (overwrites previous)
```

**Option 3: Exact path without hash**
```bash
struktur build mystack --exact
# Creates: ./build/ (uses exact path, no hash)
```

**Rationale**:
- Prevents accidental overwrites
- Builds are reproducible and easy to compare
- Safer default for production
- Easier debugging (multiple builds preserved)

---

## v0.4.0-alpha (Planned - Reliability + Strictness)

**Status**: Planned  
**Scope**: Fail fast on security and integrity issues

**Changes:**
- Unsafe output paths now throw (path traversal is a hard error)
- Unresolved classes now throw during canonical generation
- Instance files without `$id` now throw (required field)
- Invalid JSON in instance files now throws (no skip)
- Explicitly configured directories must exist (missing dirs throw)
- Template helpers now throw if `buildDir` is missing

**Migration:**
- Fix invalid JSON and add `$id` to all instances
- Correct class names referenced by instances
- Ensure CLI/config directories exist if explicitly set
- Remove any template outputs that escape the build directory

**Rationale**: These conditions indicate bugs or security issues. Failing fast prevents corrupt output and makes debugging obvious.

---

## v0.5.0-alpha (Planned - Default Strict Mode)

**Status**: Planned  
**Scope**: Enable strict checks by default (no opt-in flags)

**Changes:**
- Output-file collisions now throw (two outputs to same file)
- Instances may only use aspects declared in `$uses_aspects`
- Legacy `$aspects` array format removed (object format only)
- AJV strict mode enabled (`strictRequired`, `strictTypes`)

**Migration:**
- Ensure all aspect usage is declared in class `$uses_aspects`
- Convert `$aspects` arrays to object format
- Update schemas to satisfy AJV strict rules

**Rationale**: Strict defaults catch real issues early and keep the data model consistent.

---

## v0.2.12-alpha (December 2025)

**Tag**: v0.2.12-alpha  
**Commit**: 0e4abe0  
**Package version**: `0.2.12-alpha`

### Aspect Fields Renamed with `$` Prefix

**Breaking** (Commit: b045d54): Aspect-related fields in classes and instances now use `$` prefix.

**Classes:**
- `aspect_types` → `$uses_aspects`
- `aspect_defaults` → `$aspect_defaults`

**Instances:**
- `aspects` → `$aspects`

**Before**:
```json
{
  "$class": "server",
  "aspect_types": ["infrastructure"],
  "aspect_defaults": {
    "infrastructure": { "tier": "production" }
  }
}
```

**After**:
```json
{
  "$class": "server",
  "$uses_aspects": ["infrastructure"],
  "$aspect_defaults": {
    "infrastructure": { "tier": "production" }
  }
}
```

**Migration**: Rename fields in all class and instance files.

---

### Canonical Fields Renamed with `$` Prefix

**Breaking** (Commit: 39415f1): Top-level canonical.json fields now use `$` prefixes.

| Before | After |
|--------|-------|
| `instances` | `$instances` |
| `instances_by_id` | `$instances_by_id` |
| `classes` | `$classes` |
| `classes_by_id` | `$classes_by_id` |
| `aspects` | `$aspects` |
| `aspects_by_id` | `$aspects_by_id` |
| `metadata` | `$metadata` |
| `validation` | `$validation` |

**Migration**: Update any code parsing canonical.json to use `$`-prefixed field names.

---

### Universal Instance Base Schema

**Non-Breaking Enhancement** (Commit: 2080e03): All instances now validate against universal base schema before class-specific validation.

**What Changed**:
- Pass 0 validation: Universal contract (`schemas/instance_base.schema.json`)
- Required fields: `$id`, `$class` (already enforced)
- Optional field: `$render` (array of {template, output} objects)
- Runs before class/aspect validation

**Benefits**:
- Catch fundamental errors (missing $id/$class) early
- Instance-specific render tasks supported
- Explicit validation of render array structure

See [Concepts: Instances - Render Arrays](concepts-instances.md#render-arrays) for details.

---

### Three-Layer Aspect Merge

**Non-Breaking Enhancement** (Commit: 7799f6a): Aspect data now merges from three sources automatically.

**What Changed**:
- `$uses_aspects` accumulates through inheritance (no manual cumulative lists needed)
- `$aspect_defaults` deep merges through parent chain
- Three-layer merge: `aspect.$defaults` ⊕ `class.$aspect_defaults` ⊕ `instance.$aspects`

**Before** (manual cumulative lists):
```json
{
  "$class": "proxmox_lxc",
  "$uses_aspects": ["infrastructure", "compute_node", "proxmox_guest"]
}
```

**After** (minimal declarations):
```json
{
  "$class": "proxmox_lxc",
  "$uses_aspects": ["proxmox_guest"]  // Others inherited automatically
}
```

**Migration**: Optional. Existing stacks work unchanged. New stacks can use cleaner minimal declarations.

**Benefits**:
- DRY principle: Define aspect defaults once, inherit everywhere
- Reduced duplication
- Maintainability: Change defaults in one place

See [Concepts: Aspects - Aspect Defaults](concepts-aspects.md#aspect-defaults) for details.

---

## v0.2.11-alpha (December 2025)

**Tag**: v0.2.11-alpha  
**Commit**: 7849f56  
**Package version**: `0.2.11-alpha`

- Stack improvements: aspect_defaults, documentation updates
- Docked stack expanded with production patterns
- No breaking changes in this release

---

## v0.2.6-alpha and Earlier

### Schema `$class` Field Required

**Breaking**: All schema files must include a `$class` field matching the filename.

**Before** (worked):
```json
// server.class.json
{
  "$parent": "entity_base",
  "$fields": { "hostname": null }
}
```

**After** (required):
```json
// server.class.json
{
  "$class": "server",
  "$parent": "entity_base",
  "$fields": { "hostname": null }
}
```

**Migration**: Add `"$class": "<filename>"` to all class files.

**Rationale**: Explicit class names improve refactoring safety, eliminate filename-based inference.

---

### File Extension: `.schema.json` → `.class.json`

**Breaking**: Class definition files now use `.class.json` extension.

**Before**: `server.schema.json`  
**After**: `server.class.json`

**Migration**: Rename class files and update references.

---

### Aspect Namespace Prefix (`aspect_`)

**Breaking**: Aspect names are prefixed with `aspect_`.

**Before**:
```json
{
  "$aspects": { "page": { "menu": "header" } }
}
```

**After**:
```json
{
  "$aspects": { "aspect_page": { "menu": "header" } }
}
```

**Migration**: 
- Rename aspect files: `page.class.json` → `aspect_page.class.json`
- Update `$uses_aspects` lists
- Update `$aspect_defaults` keys
- Update template access: `$aspects.page` → `$aspects.aspect_page`

---

### Aspect Defaults Require `$defaults` Object

**Breaking**: Aspect defaults must be under `$defaults`, not at top level.

**Before**:
```json
{
  "$aspect": "aspect_network",
  "$schema": { "type": "object" },
  "$gateway": "192.168.1.1"
}
```

**After**:
```json
{
  "$aspect": "aspect_network",
  "$schema": { "type": "object" },
  "$defaults": {
    "gateway": "192.168.1.1"
  }
}
```

**Migration**: Move top-level defaults into `$defaults` object, remove `$` prefix from user fields.

---

### Instance `$class` Field Required

**Breaking**: All instances must have a `$class` field. Classless instances are rejected.

**Before** (silently skipped):
```json
{ "$id": "config", "setting": "value" }
```

**After** (required):
```json
{ "$id": "config", "$class": "config_base", "setting": "value" }
```

**Migration**: Add `$class` field to all instances, or use `global` class for global config.

---

### Strict Validation Default

**Breaking**: `--warnings-as-errors` is now the default. Extra fields cause build failures.

**Migration**: 
- Fix schema warnings (recommended)
- Or use `--no-warnings-as-errors` to restore lenient behavior (not recommended)

---

### Canonical Structure Changes

**Breaking**: Canonical output field names changed.

| Old | New | Reason |
|-----|-----|--------|
| `objects` | `instances` | More accurate terminology |
| `aspects_by_kind` | `aspects_by_id` | Consistent with classes_by_id |
| `kinds` | `$uses_aspects` | Separate from class types |

**Migration**: Update code parsing canonical.json.

---

## Migration Checklist (v0.1.x → v0.3.0)

Complete migration from early versions to v0.3.0:

- [ ] Add `$class` field to all class files (matching filename)
- [ ] Rename `.schema.json` → `.class.json`
- [ ] Add `aspect_` prefix to aspect files and references
- [ ] Move aspect defaults under `$defaults` object
- [ ] Add `$` prefix to all system fields (instances, classes, aspects)
- [ ] Update `$render` to `{template, output}` format
- [ ] Update templates to use `$`-prefixed fields
- [ ] Update templates: `{{#each $uses_aspects}}` → `{{#each (keys $aspects)}}`
- [ ] Add `$class` field to all instance files
- [ ] Update canonical.json parsers for `$`-prefixed fields
- [ ] Fix schema validation warnings
- [ ] Test with default deterministic builds
- [ ] Update file paths/scripts for hash-based build directories

---

## Future Breaking Changes (Planned)

- **v1.0.0**: API stabilization, no more breaking changes without major version bump
- Hook system API (if/when implemented)

---

**Questions?** Open an issue: [GitHub Issues](https://github.com/nucleic-se/struktur/issues)
