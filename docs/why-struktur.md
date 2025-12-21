# Why Struktur?

Struktur solves a specific problem: **generating validated configuration files from structured data**. This page explains when Struktur is the right tool and when it's not.

## The Problem

You have configuration that needs to be:
- **Type-safe** (catch errors before deployment)
- **Multi-environment** (dev/staging/prod with different values)
- **DRY** (don't repeat yourself across files)
- **Composable** (mix and match features)
- **Auditable** (know where each value came from)

**Current solutions have tradeoffs:**

| Tool | Pros | Cons |
|------|------|------|
| **Helm** | Kubernetes integration | YAML + Go templates hard to debug, K8s-only |
| **Kustomize** | Simple overlays | Kubernetes-only, limited composition |
| **Terraform** | State management | HCL DSL, module nesting complexity |
| **CUE/Jsonnet** | Powerful validation | New language to learn, steep curve |
| **Ansible** | Agentless execution | Imperative, harder to validate |
| **Plain YAML** | Simple, universal | No validation, easy to break |

**What if you could:**
- Use **standard JSON Schema** (no new language)
- Generate **any format** (not locked to one ecosystem)
- Compose with **aspects** (cleaner than inheritance)
- Get **IDE support** for free (schema = autocomplete)
- Have **deterministic builds** (same input = same output)

That's Struktur.

---

## Core Philosophy

### 1. Build-Time Validation > Runtime Errors

```bash
# ❌ Runtime surprise (after deployment)
Error: Invalid port "8o8o" in service "api"

# ✅ Build-time catch (before deployment)
Error: instances/api-prod.json
  Invalid value "8o8o" for property "port"
  Expected: integer between 1-65535
```

**Why this matters:**
- Failed deployments are expensive (downtime, rollback costs)
- Build-time = fast feedback loop (seconds, not minutes)
- Catch entire classes of errors (typos, wrong types, missing fields)

### 2. Standard Schemas > DSLs

```json
// Struktur: Standard JSON Schema (works everywhere)
{
  "$class": "service",
  "$schema": {
    "type": "object",
    "required": ["port"],
    "properties": {
      "port": { "type": "integer", "minimum": 1, "maximum": 65535 }
    }
  }
}
```

**vs custom DSL:**
```
// CUE, Jsonnet, HCL: New syntax to learn
port: int & >0 & <65535  // CUE
port: std.parseInt('8080')  // Jsonnet  
port = var.service_port  // HCL
```

**JSON Schema gets you:**
- ✅ IDE autocomplete and validation
- ✅ Documentation generators
- ✅ No new syntax to learn
- ✅ Massive existing ecosystem

### 3. Aspect Composition > Inheritance

**Inheritance:** Linear, forces choices too early

```
entity → service → web_service → api_service
              ↓
         database_service (can't be web!)
```

**Aspects:** Mix and match features

```json
{
  "$id": "api",
  "$class": "service",
  "$aspects": {
    "web_service": { "port": 8080 },
    "database": { "connection": "postgres://..." },
    "aspect_monitoring": { "metrics_port": 9090 }
  }
}
```

Same service can have web + database + monitoring aspects. No forced hierarchy.

### 4. Explicit > Implicit

```yaml
# ❌ Magic conventions (unclear)
services:
  api:
    # Where did port 8080 come from?
    # What other defaults are set?
    image: nginx
```

```json
// ✅ Explicit merge (traceable)
{
  "$id": "api",
  "$class": "service",  // ← Inherited: replicas: 1
  "port": 8080,        // ← Explicit override
  "$aspects": {
    "web_service": {   // ← Aspect adds: proxy_pass
      "upstream": "backend:3000"
    }
  }
}
```

Struktur's canonical output shows **exactly** what got merged from where.

---

## When to Choose Struktur

### ✅ Perfect Fit

**Multi-environment configurations**
- Same structure, different values (dev/staging/prod)
- Need validation before deployment
- Example: Kubernetes manifests, Docker Compose, Terraform

**Generated documentation**
- Structured content → HTML/Markdown
- Schema ensures required fields
- Example: API docs, runbooks, knowledge bases

**Configuration management**
- Many similar items (servers, services, users)
- Consistency matters
- Example: Ansible inventory, network configs

**Asset catalogs**
- Structured metadata
- Multiple output formats
- Example: Design systems, product catalogs

### ⚠️ Maybe Not

**One-off scripts**
- Setup overhead not worth it for single use

**Highly dynamic data**
- Changes constantly at runtime
- Can't pre-validate effectively

**Simple templating**
- If you just need Handlebars, use Handlebars
- Struktur adds structure + validation (only worth it if you need that)

**Runtime-only validation**
- Service mesh, dynamic discovery
- Validation happens after deploy

---

## Struktur vs Alternatives

### vs Helm (Kubernetes)

| Feature | Struktur | Helm |
|---------|----------|------|
| **Validation** | JSON Schema (type-safe) | Limited (YAML structure only) |
| **Templates** | Handlebars/Nunjucks | Go templates |
| **Scope** | Any config format | Kubernetes only |
| **Composition** | Aspects (mix/match) | Chart dependencies (nested) |
| **Learning curve** | Standard tools | Helm-specific concepts |

**Choose Struktur if:** You need validation beyond Kubernetes, want aspect composition, prefer standard templates

**Choose Helm if:** Kubernetes-only, need Helm ecosystem (charts, repos)

### vs Terraform Modules

| Feature | Struktur | Terraform |
|---------|----------|-----------|
| **Language** | JSON data + templates | HCL (Terraform language) |
| **State** | Stateless (pure build) | Stateful (tracks resources) |
| **Validation** | Build-time schema | Plan-time + runtime |
| **Composition** | Aspects | Module nesting |
| **Output** | Any format | Terraform providers |

**Choose Struktur if:** Generating Terraform HCL, need validation before `terraform plan`, want aspect composition

**Choose Terraform if:** Managing cloud resources directly, need state tracking

### vs CUE/Jsonnet

| Feature | Struktur | CUE/Jsonnet |
|---------|----------|-------------|
| **Language** | JSON Schema (standard) | Custom DSL |
| **Templates** | Handlebars/Nunjucks | Built-in |
| **Learning curve** | Use existing knowledge | New syntax |
| **IDE support** | JSON Schema ecosystem | Tool-specific |
| **Flexibility** | Template engine choice | Fixed approach |

**Choose Struktur if:** Prefer standard tools, want template flexibility, existing JSON Schema knowledge

**Choose CUE/Jsonnet if:** Need advanced validation logic, OK learning new syntax

### vs Ansible

| Feature | Struktur | Ansible |
|---------|----------|---------|
| **Approach** | Declarative data → files | Imperative tasks |
| **Validation** | Schema + build-time | Runtime (during play) |
| **Execution** | Generates files only | Executes on hosts |
| **Composition** | Aspects | Roles + includes |
| **Use case** | Config generation | Infrastructure automation |

**Choose Struktur if:** Generating Ansible inventory/playbooks, validation before execution

**Choose Ansible if:** Need actual execution (not just file generation)

### vs Plain YAML/JSON

| Feature | Struktur | Plain Files |
|---------|----------|-------------|
| **Validation** | Schema enforced | None (or manual) |
| **DRY** | Inheritance + aspects | Copy-paste or scripts |
| **Traceability** | Canonical output | Unclear |
| **Learning curve** | Setup required | None |

**Choose Struktur if:** More than 5-10 files, consistency matters, validation important

**Choose plain files if:** Very simple use case, one-off project

---

## The Struktur Advantage

### 1. Fails Fast
Catch errors in **seconds** (build time), not **minutes** (deploy time) or **hours** (production incidents).

### 2. Scales Cleanly
Start with 3 services, grow to 300. Schema + aspects + inheritance = maintainable at scale.

### 3. No Lock-In
- Standard JSON Schema (portable)
- Standard templates (Handlebars = 10+ years old)
- Generates static files (no runtime dependency)

### 4. Auditable
Canonical output shows **exactly** what got merged:
```json
{
  "$id": "api-prod",
  "$class": "service",
  "_meta": {
    "merged_from": [
      "classes/service.class.json (replicas: 1)",
      "aspects/web_service.aspect.json (port, upstream)",
      "instances/api-prod.json (replicas: 3, port: 8080)"
    ]
  }
}
```

### 5. Composable
Aspects = features you can mix/match without inheritance restrictions.

---

## Real-World Impact

### Before Struktur
```yaml
# docker-compose.yml
services:
  api-dev:
    image: api:latest
    ports: ["3000:3000"]
    # Forgot health check!
    # Typo in port!
    # No validation!
  
  api-prod:
    image: api:latest
    ports: ["8o8o:8080"]  # ← TYPO (runtime error)
    # Inconsistent with dev
```

### After Struktur
```bash
$ struktur build
Error: instances/api-prod.json
  Invalid value "8o8o" for property "port"
  Expected: integer between 1-65535
  
$ # Fix typo, rebuild
$ struktur build
✓ Validated 2 instances
✓ Generated docker-compose.yml (dev + prod)
```

**Result:** Error caught in 2 seconds, not after deploy.

---

## Getting Started

1. **Check if Struktur fits** (see "When to Choose" above)
2. **Install:** `npm install -g @nucleic-se/struktur@alpha`
3. **Try an example:** `struktur init --example docked my-stack`
4. **Read docs:** Start with [Quick Start](quickstart.md)
5. **Build something real:** Start small (5-10 instances)

---

## Questions?

**"Do I need to learn JSON Schema?"**  
Basic knowledge helps (10 min tutorial). Struktur includes examples you can copy.

**"What if I need runtime validation?"**  
Struktur is build-time only. For runtime, use tools like Kubernetes admission controllers.

**"Can I use my existing templates?"**  
If they're Handlebars or Nunjucks, probably! Struktur adds helpers but vanilla syntax works.

**"What's the migration path?"**  
Start with one service/resource as proof of concept. Expand incrementally.

**"Is this production-ready?"**  
Current status: Alpha (v0.2.x). Core is stable, API may have breaking changes. Use for new projects, evaluate for production.

---

## See Also

- [Use Cases](use-cases.md) - Non-infrastructure examples
- [Quick Start](quickstart.md) - Get started in 5 minutes
- [Concepts](concepts-build-pipeline.md) - Core mental models
- [Examples](../examples/) - Working code to learn from