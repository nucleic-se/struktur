# Breaking Changes

This document tracks breaking changes in Struktur's alpha releases.

> ⚠️ **Alpha Software**: Breaking changes are expected before 1.0. We document them here to help with migration.

---

## v0.2.9-alpha (December 2025)

### Universal Instance Base Schema (Non-Breaking Enhancement)

**New Feature**: All instances now validate against a universal base schema before class-specific validation.

**What Changed**:
- Pass 0 validation: Universal contract (`schemas/instance_base.schema.json`)
- Required fields: `id`, `class` (already enforced by earlier changes)
- Optional field: `render` (array of {template, output} objects for instance-specific rendering)
- Runs before class/aspect validation (fail-fast on fundamental errors)

**Fully Backward Compatible**:
```json
// Existing instances already have id/class - no changes needed
{
  "id": "web-01",
  "class": "server",
  "hostname": "web.example.com"
}

// New: Instances can now specify own render tasks
{
  "id": "web-01",
  "class": "server",
  "hostname": "web.example.com",
  "render": [
    {"template": "nginx.conf.hbs", "output": "nginx/{{ id }}.conf"}
  ]
}
```

**Migration**: None required. Existing instances already meet base schema requirements.

**Benefits**:
- Catch fundamental errors (missing id/class) with clear messages before any class validation
- Instance-specific render tasks: per-instance configs, service docs, environment-specific outputs
- Explicit validation of render array structure (no silent failures)

See [Concepts: Instances - Render Arrays](concepts-instances.md#render-arrays) for details.

### Three-Layer Aspect Merge (Non-Breaking Enhancement)

**New Feature**: Aspect data now merges from three sources automatically.

**What Changed**:
- $uses_aspects accumulates through inheritance (no manual cumulative lists needed)
- $aspect_defaults deep merges through parent chain
- Three-layer merge: aspect.defaults ⊕ class.$aspect_defaults ⊕ instance.$aspects

**Fully Backward Compatible**:
```json
// Old style (explicit cumulative lists) - still works
{
  "class": "proxmox_lxc",
  "$uses_aspects": ["infrastructure", "compute_node", "proxmox_guest"]
}

// New style (minimal declarations) - now works too
{
  "class": "proxmox_lxc",
  "$uses_aspects": ["proxmox_guest"]  // Others inherited automatically
}
```

**Migration**: None required. Existing stacks work unchanged. New stacks can use cleaner minimal declarations.

**Benefits**:
- DRY principle: Define aspect defaults once, inherit everywhere
- Reduced duplication: No need to repeat aspect fields in every instance
- Maintainability: Change defaults in one place

See [Concepts: Aspects - Aspect Defaults](concepts-aspects.md#aspect-defaults) for details.

---

## v0.3.0-alpha (Planned)

### Canonical Top-Level Fields Use `$` Prefix

**Breaking**: All top-level canonical.json fields now use `$` prefixes.

**Before:**
```json
{
  "instances": [...],
  "instances_by_id": {...},
  "classes": [...],
  "classes_by_id": {...},
  "aspects": [...],
  "aspects_by_id": {...},
  "metadata": {...},
  "validation": {...}
}
```

**After:**
```json
{
  "$instances": [...],
  "$instances_by_id": {...},
  "$classes": [...],
  "$classes_by_id": {...},
  "$aspects": [...],
  "$aspects_by_id": {...},
  "$metadata": {...},
  "$validation": {...}
}
```

**Migration**: Update any canonical.json consumers and templates to use `$`-prefixed fields.

---

## v0.2.0-alpha (December 2025)

### Schema `class` Field Required

**Breaking**: All schema files must now include a `class` field matching the filename.

**Before** (worked):
```json
// server.schema.json
{
  "parent": "entity_base",
  "hostname": null,
  "schema": {
    "type": "object",
    "properties": { "hostname": { "type": "string" } }
  }
}
```

**After** (required):
```json
// server.schema.json
{
  "class": "server",
  "parent": "entity_base",
  "hostname": null,
  "schema": {
    "type": "object",
    "properties": { "hostname": { "type": "string" } }
  }
}
```

**Migration**: Add `"class": "<filename>"` to all schema files. A migration script ran automatically for 70+ schemas.

**Rationale**: Explicit class names improve refactoring safety and eliminate filename-based inference.

### Canonical Structure Changes

**Breaking**: Canonical output field names changed for consistency.

| Old Name | New Name | Reason |
|----------|----------|--------|
| `objects` | `instances` | More accurate terminology |
| `aspects_by_kind` | `aspects_by_id` | Consistent with `classes_by_id` |
| `kinds` (overloaded) | `$uses_aspects` | Separate from class `types` |

**Migration**: Update any code parsing canonical.json to use new field names.

### Instance `class` Field Required

**Breaking**: All instances must have a `class` field. Classless instances are now rejected with an error.

**Before** (silently skipped):
```json
{ "id": "config", "setting": "value" }
```

**After** (required):
```json
{ "id": "config", "class": "config_base", "setting": "value" }
```

**Migration**: Add `class` field to all instance files, or use `global` class for global config.

### Strict Validation Default

**Breaking**: `--warnings-as-errors` is now the default. Extra fields and unknown keywords cause build failures.

**Migration**: Fix schema warnings, or use `--no-warnings-as-errors` to restore old behavior (not recommended).

---

## v0.1.x → v0.2.x Migration Checklist

- [ ] Add `class` field to all schema files
- [ ] Add `class` field to all instance files
- [ ] Update canonical.json consumers (`objects` → `instances`)
- [ ] Fix any schema validation warnings
- [ ] Test build with strict validation (default)

---

## Future Breaking Changes (Planned)

These changes are planned for future releases:

- **v0.3.0**: Hook system API finalization
- **v1.0.0**: Stable API, no more breaking changes without major version bump

---

**Questions?** Open an issue: [GitHub Issues](https://github.com/nucleic-se/struktur/issues)
