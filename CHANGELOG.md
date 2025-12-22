# Changelog

All notable changes to Struktur will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.4.2-alpha] - 2025-12-22

### Added

**Template Safety Features:**
- `--no-strict-templates` CLI flag for permissive template mode (default: strict)
- Safe template helpers: `exists()`, `has()`, `get()` for undefined-safe property access
- Template strict mode throws on undefined variables (Handlebars only, Nunjucks always permissive)
- Comprehensive template error messages with search paths and suggestions

**Reliability Improvements:**
- Atomic file writes for all output files (canonical.json, templates, manifests)
- Write-to-temp + rename pattern prevents corruption on crashes
- Easy library swap-out via comments (write-file-atomic compatible)

### Changed

- All example templates updated to use safe helpers (`exists`, `has`, `get`)
- Handlebars templates now fail-fast on undefined variables by default
- Template error handling improved with structured context display

### Fixed

- Variable shadowing bug in instance_loader.js (dir → dirEntry)
- Template errors now show helpful suggestions and full context

### Technical

- 527 tests passing (100% pass rate)
- New test suite: `template_strict_mode.test.js`
- Enhanced test suite: `strictness_upgrades.test.js`
- All 7 fs.writeFile calls replaced with atomicWrite
- Custom atomic_write.js utility (15 lines, no dependencies)

### Migration Guide

**For strict template mode (recommended):**
```handlebars
<!-- Before: Can fail silently on undefined -->
{{$aspects.docker_container.image}}

<!-- After: Safe access -->
{{get $aspects "docker_container.image"}}

<!-- Check existence -->
{{#if (exists $aspects)}}
  {{#if (has $aspects "docker_container")}}
    {{get $aspects "docker_container.image"}}
  {{/if}}
{{/if}}
```

**To disable strict mode:**
```bash
struktur build --no-strict-templates
```

**Config file:**
```json
{
  "strict_templates": false
}
```

---

## [0.4.0-alpha] - 2025-12-14

### Breaking Changes

**Fail-Fast Security & Integrity:**
- Unsafe output paths throw (path traversal blocked)
- Unresolved classes throw during canonical generation
- Missing `$id` throws on instance load (required field)
- Invalid JSON throws with context (no silent skip)
- Explicitly configured directories must exist (catch typos)
- Missing `buildDir` throws in template helpers

**Strict Validation:**
- Output-file collision detection prevents silent overwrites
- Aspect declaration enforcement (instances only use declared aspects)
- Legacy `$aspects` array format removed (object format only)
- AJV strict mode enabled

See [docs/breaking-changes.md](docs/breaking-changes.md#v040-alpha-december-2025) for full details.

---

## [0.3.0-alpha] - 2025-12-10

### Breaking Changes

- All system/meta fields now use `$` prefix (`id` → `$id`, `class` → `$class`, etc.)
- Canonical output structure updated with `$` prefixes
- Schema validation enforces `$` prefixes

See [docs/breaking-changes.md](docs/breaking-changes.md#v030-alpha-december-2025) for migration guide.

---

## Earlier Versions

See [docs/breaking-changes.md](docs/breaking-changes.md) for full history.
