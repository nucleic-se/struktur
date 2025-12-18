# Use Cases

Struktur's **structured data + validation + templates** pattern works far beyond infrastructure. Here are real-world use cases across different domains.

## Infrastructure as Code

The original use case, but worth highlighting the breadth:

### Docker Orchestration
**Problem:** Managing multi-container applications across environments  
**Solution:** Container instances + docker_container aspects → docker-compose.yml  
**Example:** See `examples/docked/` - 5 containers with health checks, dependencies, networks

### Kubernetes Manifests
**Problem:** YAML sprawl, environment differences, resource relationships  
**Solution:** Pod/Service/Deployment instances + k8s aspects → manifests  
**Benefit:** Schema validation catches typos, DRY resource definitions

### Terraform Configuration
**Problem:** HCL modules nested 5 levels deep, unclear dependencies  
**Solution:** Resource instances + terraform aspects → .tf files  
**Benefit:** Aspect composition cleaner than module nesting

### Ansible Inventory/Playbooks
**Problem:** Duplicated host vars, inconsistent playbook structure  
**Solution:** Host instances + ansible aspects → inventory YAML + playbooks  
**Benefit:** Type-safe inventory, validated playbook generation

---

## Development Tools

### ESLint/Prettier Configs
**Problem:** Each project reinvents lint configs, inconsistent standards  
**Solution:** Rule instances + linter aspects → .eslintrc.json, .prettierrc  
**Example:**
```json
// instances/strict-typescript.json
{
  "id": "strict-typescript",
  "class": "eslint_config",
  "extends": ["base-typescript"],
  "aspects": {
    "typescript": {
      "strict": true,
      "no_explicit_any": "error"
    }
  }
}
```

**Output:** Validated, consistent configs across projects

### Project Scaffolds
**Problem:** Manual boilerplate setup, forgotten config files  
**Solution:** Project instances + framework aspects → package.json, tsconfig, etc.  
**Benefit:** Validated project templates, no missing pieces

### VS Code Workspace Settings
**Problem:** Team members have different editor configs  
**Solution:** Settings instances + vscode aspects → .vscode/settings.json  
**Benefit:** Consistent dev environment, schema-validated settings

---

## Content Management

### Blog/Documentation Sites
**Problem:** Inconsistent frontmatter, broken internal links  
**Solution:** Post instances + content aspects → markdown + HTML  
**Example:** See `examples/skribe/` - Static site generator with tags, RSS

### Course Materials
**Problem:** Lessons missing required metadata, broken module structure  
**Solution:** Lesson instances + course aspects → LMS-compatible SCORM packages  
**Benefit:** Required fields enforced, automated TOC generation

### Knowledge Base Articles
**Problem:** Inconsistent article structure, orphaned content  
**Solution:** Article instances + kb aspects → searchable docs  
**Benefit:** Schema ensures all articles have title/author/date/category

---

## Asset Management

### Design Systems
**Problem:** Component documentation out of sync with code  
**Solution:** Component instances + design aspects → docs + usage examples  
**Example:**
```json
// instances/button.json
{
  "id": "button",
  "class": "component",
  "category": "forms",
  "aspects": {
    "design": {
      "variants": ["primary", "secondary", "danger"],
      "props": ["onClick", "disabled", "size"]
    }
  }
}
```

**Output:** Auto-generated component catalog, API docs

### Icon/Image Catalogs
**Problem:** Lost track of what icons/images exist, inconsistent metadata  
**Solution:** Asset instances + media aspects → catalog HTML + sprite sheets  
**Benefit:** Validated metadata, searchable catalog

### Font Collections
**Problem:** Font licensing unclear, usage patterns undocumented  
**Solution:** Font instances + typography aspects → usage guide + CSS  
**Benefit:** License compliance tracking, automatic @font-face generation

---

## Business Operations

### Equipment Inventory
**Problem:** Spreadsheet chaos, no validation, lost equipment  
**Solution:** Equipment instances + inventory aspects → reports + labels  
**Example:**
```json
// instances/laptop-001.json
{
  "id": "laptop-001",
  "class": "equipment",
  "serial": "ABC123",
  "assigned_to": "jane.doe",
  "aspects": {
    "hardware": {
      "make": "Dell",
      "model": "Precision 5560",
      "purchase_date": "2024-01-15",
      "warranty_expires": "2027-01-15"
    }
  }
}
```

**Output:** QR code labels, maintenance schedules, depreciation reports

### Compliance/Policy Documents
**Problem:** Policies inconsistent, approval status unclear  
**Solution:** Policy instances + compliance aspects → formatted docs + audit trail  
**Benefit:** Required approvals enforced, version history automatic

### Service Catalogs
**Problem:** Service offerings inconsistently described  
**Solution:** Service instances + catalog aspects → customer-facing docs  
**Benefit:** Standardized descriptions, automatic pricing tables

---

## Product Management

### Feature Specifications
**Problem:** Features missing acceptance criteria, unclear dependencies  
**Solution:** Feature instances + spec aspects → formatted specs  
**Benefit:** Required fields enforced, dependency graphs generated

### Release Notes
**Problem:** Inconsistent formatting, missed announcements  
**Solution:** Release instances + changelog aspects → customer-facing notes  
**Benefit:** Validated content, multiple formats (email, docs, in-app)

### Product Catalogs
**Problem:** SKUs missing attributes, pricing errors  
**Solution:** Product instances + catalog aspects → e-commerce exports  
**Benefit:** Schema catches missing required fields, price validation

---

## Why Struktur Works Here

All these use cases share characteristics that make Struktur a good fit:

1. **Structured data** - You can define what fields are required
2. **Multiple instances** - More than one-off, worth the setup
3. **Validation matters** - Errors caught early save time/money
4. **Multiple outputs** - Same data renders to HTML, JSON, CSV, etc.
5. **Composition helps** - Aspects add optional features cleanly
6. **Build-time** - Can generate everything ahead of time

**When Struktur might NOT fit:**

- Highly dynamic data (changes constantly at runtime)
- One-off projects (setup overhead not worth it)
- No clear schema (free-form, unstructured data)
- Runtime-only validation needed
- Simple templating (just use Handlebars directly)

---

## Getting Started

Pick a use case above that resonates, then:

1. **Define your class** - What fields does each instance need?
2. **Add aspects** - What optional features can items have?
3. **Create instances** - Your actual data
4. **Write templates** - How should output look?
5. **Build** - `struktur build` and iterate

Start small (5-10 instances) to validate the pattern before scaling up.

---

## See Also

- [Concepts: Classes](concepts-classes.md) - How to define types
- [Concepts: Aspects](concepts-aspects.md) - Composable extensions
- [Concepts: Templates](concepts-templates.md) - Output generation
- [Examples](../examples/) - Working reference implementations
