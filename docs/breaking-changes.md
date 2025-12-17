# Breaking Changes

This document tracks breaking changes in Struktur's alpha releases.

> ⚠️ **Alpha Software**: Breaking changes are expected before 1.0. We document them here to help with migration.

---

## v0.2.0-alpha (December 2025)

### Schema `class` Field Required

**Breaking**: All schema files must now include a `class` field matching the filename.

**Before** (worked):
```json
// server.schema.json
{
  "type": "object",
  "properties": { "hostname": { "type": "string" } }
}
```

**After** (required):
```json
// server.schema.json
{
  "class": "server",
  "type": "object",
  "properties": { "hostname": { "type": "string" } }
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
| `kinds` (overloaded) | `aspect_types` | Separate from class `types` |

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
