# Struktur Documentation

Welcome to Struktur's documentation. This is your central hub for learning and reference.

## 🎯 Start Here

**First time?** Begin with these:

- **[Why Struktur?](why-struktur.md)** - Philosophy, positioning, and when to use it
- **[Use Cases](use-cases.md)** - Real-world examples across 7 domains
- **[Quickstart](quickstart.md)** - 5 minutes from install to first build

## 📚 Learning Path

**Ready to build?** Follow this path:

1. **[Quickstart](quickstart.md)** - 5 minutes from install to first build
2. **[Tutorial: Your First Stack](tutorial-first-stack.md)** - Build a simple blog from scratch
3. **[Tutorial: Extending Universal](tutorial-extending-universal.md)** - Learn composition patterns
4. **[Example: Docked](../examples/docked/README.md)** - Docker container modeling
5. **[Example: Skribe](../examples/skribe/README.md)** - Static site generation

## 🎯 Core Concepts

Understanding Struktur's data model:

- **[Build Pipeline](concepts-build-pipeline.md)** - Four-phase deterministic builds (start here for the big picture)
- **[Classes & Schemas](concepts-classes-schemas.md)** - Define data shapes with inheritance
- **[Instances](concepts-instances.md)** - Your actual data, validated and merged
- **[Aspects](concepts-aspects.md)** - Composable data namespaces
- **[Canonical Output](concepts-canonical.md)** - Merged data structure
- **[Validation](concepts-validation.md)** - Multi-layer schema checking
- **[Templates](concepts-templates.md)** - Generate text from validated data
- **[Template Buffers](concepts-template-buffers.md)** - Named content buffers for layouts and multi-file output

## 📖 Reference

Quick lookup for specifics:

- **[CLI Reference](cli-reference.md)** - All commands, flags, and config options
- **[Helper Reference](helpers-reference.md)** - Built-in template helpers
- **[Naming Conventions](conventions/naming.md)** - System fields, classes, helpers
- **[Error Troubleshooting](errors-troubleshooting.md)** - Common problems and solutions

## 🛠️ Guides

Real-world patterns and practices:

- **[Stack Organization Patterns](guide-stack-patterns.md)** - Layering, mixins, monorepos
- **[Breaking Changes](breaking-changes.md)** - Alpha → beta migration notes

## 🆘 Getting Help

- **Troubleshooting**: Check [errors-troubleshooting.md](errors-troubleshooting.md) first
- **Issues**: [GitHub Issues](https://github.com/nucleic-se/struktur/issues)
- **Email**: daddy@nucleic.se

## 💡 Quick Links by Task

**I want to...**

- **...understand if Struktur fits my use case** → [Why Struktur?](why-struktur.md)
- **...see what Struktur can do** → [Use Cases](use-cases.md)
- **...get started fast** → [Quickstart](quickstart.md)
- **...understand the mental model** → [Concepts](concepts-build-pipeline.md)
- **...see working examples** → [Docked](../examples/docked/README.md) or [Skribe](../examples/skribe/README.md)
- **...compare to alternatives** → [Why Struktur? (Comparisons)](why-struktur.md#struktur-vs-alternatives)
- **...look up a CLI flag** → [CLI Reference](cli-reference.md)
- **...find a template helper** → [Helper Reference](helpers-reference.md)
- **...fix an error** → [Troubleshooting](errors-troubleshooting.md)
- **...organize multiple stacks** → [Stack Patterns](guide-stack-patterns.md)
- **...extend Universal** → [Extending Universal](tutorial-extending-universal.md)

---

## 📊 Documentation Status

**Recently Added:**
- ✅ [Why Struktur?](why-struktur.md) - Philosophy, comparisons, decision criteria (375 lines)
- ✅ [Use Cases](use-cases.md) - 7 domains with concrete examples (373 lines)
- ✅ [Template Best Practices](concepts-templates.md) - HTML escaping, troubleshooting (updated)
- ✅ Example Design Philosophy - Opinionated and minimal framing (3 examples updated)

**Version**: 0.2.5-alpha  
**Status**: Alpha (breaking changes expected before 1.0)  
**Tests**: 451/451 passing ✅ (448 pass, 3 skip, 0 fail)
