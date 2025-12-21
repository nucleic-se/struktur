# Stack Organization Patterns

Real-world patterns for organizing Struktur stacks.

## Layering Pattern

Use multiple class/instance directories to create overlays:

```bash
struktur build \
  -c universal/classes \
  -c company/classes \
  -c project/classes \
  -i base/instances \
  -i prod/instances
```

**Order matters**: Later directories override earlier ones for same-ID instances.

## Mixin Pattern

Add optional features via separate directories:

```
mystack/
├── classes/
├── instances/
├── templates/
└── mixins/
    ├── dark-theme/
    │   ├── instances/global.json    # Adds theme: "dark"
    │   └── templates/dark.css
    └── rss/
        ├── instances/rss_feed.json
        └── templates/feed.xml
```

Include mixins explicitly:

```bash
struktur build mystack -i mystack/mixins/rss/instances -t mystack/mixins/rss/templates
```

See [Skribe example](../examples/skribe/README.md) for mixin implementation.

## Multi-Environment Pattern

Separate instances by environment:

```
mystack/
├── classes/
├── instances/
│   ├── base/           # Shared across all environments
│   ├── dev/            # Development overrides
│   ├── staging/        # Staging overrides
│   └── prod/           # Production overrides
└── templates/
```

Build for specific environment:

```bash
# Development
struktur build -c classes -i instances/base -i instances/dev -t templates

# Production
struktur build -c classes -i instances/base -i instances/prod -t templates
```

## Monorepo Pattern

Share universal classes across multiple stacks:

```
monorepo/
├── universal/          # Shared base classes
│   └── classes/
├── stacks/
│   ├── web-app/
│   │   ├── classes/    # Extends universal
│   │   ├── instances/
│   │   └── struktur.build.json
│   └── api-server/
│       ├── classes/
│       ├── instances/
│       └── struktur.build.json
```

Each stack's `struktur.build.json`:

```json
{
  "classes": ["../../universal/classes", "./classes"],
  "instances": ["./instances"],
  "templates": ["./templates"]
}
```

## Template Override Pattern

Override templates from base stack:

```bash
# Base templates searched first, then overrides
struktur build -t base/templates -t theme/templates
```

First match wins. To override `layout.html`, create `theme/templates/layout.html`.

See [Template Collision](concepts-templates.md#template-collisions) for details.

---

**See also**: [Docked example](../examples/docked/README.md) (layered domains), [Skribe example](../examples/skribe/README.md) (mixins)