# Errors & Troubleshooting

Common errors, their causes, and solutions.

## Table of Contents

- [Path Resolution Errors](#path-resolution-errors)
- [Template Collisions](#template-collisions)
- [Schema Validation Errors](#schema-validation-errors)
- [Class & Inheritance Errors](#class--inheritance-errors)
- [Build Errors](#build-errors)
- [Configuration Errors](#configuration-errors)
- [Version Errors](#version-errors)
- [Debugging Techniques](#debugging-techniques)

---

## Path Resolution Errors

### Error: Cannot find classes directory

```
Error: Cannot find classes directory: ../universal/classes
ENOENT: no such file or directory
```

**Cause:**
Relative path not found from current working directory or config file directory.

**Solution:**

1. **Check path resolution context:**
   - CLI arguments (`-c`, `-i`, `-t`): Relative to current working directory
   - Config file paths: Relative to config file's directory

2. **Verify directory exists:**
   ```bash
   # From your current directory
   ls -la ../universal/classes
   
   # Absolute path
   ls -la /full/path/to/universal/classes
   ```

3. **Use absolute paths if needed:**
   ```bash
   struktur build -c /full/path/to/classes
   ```

4. **Check struktur.build.json path resolution:**
   ```json
   {
     "classes": ["../universal/classes", "./classes"]
   }
   ```
   These paths are relative to the config file's location, not CWD.

5. **Build from correct directory:**
   ```bash
   # If struktur.build.json references ../universal
   # Run from the stack directory:
   cd mystack && struktur build .
   
   # Or let auto-discovery find the config:
   struktur build mystack  # from parent
   ```

---

### Error: Template not found

```
Error: Template not found: post.html.hbs
```

**Cause:**
Template file doesn't exist in specified template directories.

**Solution:**

1. **Verify template exists:**
   ```bash
   ls templates/post.html.hbs
   ```

2. **Check template directory path:**
   ```bash
   struktur build -c classes/ -i instances/ -t templates/
   ```

3. **Multiple template directories:**
   ```bash
   # Templates loaded from all directories
   struktur build -t base/templates/ -t theme/templates/
   ```

4. **Case sensitivity matters:**
   ```
   post.html.hbs ≠ Post.html.hbs
   ```

---

## Template Collisions

### Error: Template collision detected

```
Error: Template collision detected
Template "layout.html.hbs" exists in multiple directories:
  - base/templates/layout.html.hbs
  - theme/templates/layout.html.hbs

Use --allow-template-collisions to permit (last directory wins)
```

**Cause:**
Same template filename exists in multiple template directories.

**Solution:**

**Option 1: Rename templates (recommended):**
```bash
# Make names unique
mv theme/templates/layout.html.hbs theme/templates/theme-layout.html.hbs
```

**Option 2: Allow collisions (intentional override):**
```bash
# Last directory wins
struktur build base theme --allow-template-collisions
# theme/templates/layout.html.hbs will be used
```

**Option 3: Reorganize templates:**
```
templates/
├── shared/
│   └── layout.html.hbs
├── posts/
│   └── post.html.hbs
└── pages/
    └── page.html.hbs
```

---

## Schema Validation Errors

### Error: Missing required property

```
Validation Error (instance: my-post)
Property "title" is required but not provided
Schema: post.class.json
```

**Cause:**
Instance missing required field from schema.

**Solution:**

1. **Add missing property:**
   ```json
   {
     "$id": "my-post",
     "$class": "post",
     "title": "My Post Title"
   }
   ```

2. **Check inheritance:**
   - Required fields can come from parent classes
   - Verify class hierarchy:
     ```bash
     struktur info -c classes/
     ```

3. **Make field optional in schema:**
   ```json
   {
     "properties": {
       "title": {
         "type": "string"
       }
     },
     "required": []
   }
   ```

---

### Error: Type mismatch

```
Validation Error (instance: user-123)
Property "age" expected type "number" but got "string"
Value: "25"
```

**Cause:**
Property value doesn't match schema type.

**Solution:**

1. **Fix instance value:**
   ```json
   {
     "$id": "user-123",
     "$class": "user",
     "age": 25
   }
   ```

2. **Allow multiple types:**
   ```json
   {
     "properties": {
       "age": {
         "type": ["number", "string"]
       }
     }
   }
   ```

3. **Check JSON syntax:**
   ```
   "25"   → String (quoted)
   25     → Number (no quotes)
   ```

---

### Error: Constraint violation

```
Validation Error (instance: blog-post)
Property "excerpt" length 250 exceeds maxLength 200
```

**Cause:**
Value violates schema constraint.

**Solution:**

1. **Shorten value:**
   ```json
   {
     "excerpt": "This is a shorter excerpt under 200 characters."
   }
   ```

2. **Adjust schema constraint:**
   ```json
   {
     "properties": {
       "excerpt": {
         "type": "string",
         "maxLength": 300
       }
     }
   }
   ```

3. **Remove constraint if not needed:**
   ```json
   {
     "properties": {
       "excerpt": {
         "type": "string"
       }
     }
   }
   ```

---

### Error: Unknown property (strict validation)

```
Warning: Instance "my-post" has extra property "subtitle"
Class "post" schema does not define this property
```

**Cause:**
Instance has property not in schema (warnings-as-errors mode).

**Solution:**

1. **Add property to schema:**
   ```json
   {
     "properties": {
       "subtitle": {
         "type": "string"
       }
     }
   }
   ```

2. **Remove property from instance:**
   ```json
   {
     "$id": "my-post",
     "$class": "post",
     "title": "My Post"
   }
   ```

3. **Build without strict validation (not recommended):**
   ```bash
   # Future: --no-warnings-as-errors flag
   # Current: All warnings are errors by default
   ```

---

## Class & Inheritance Errors

### Error: Schema class field mismatch

```
BREAKING CHANGE VIOLATION
Schema file "entity_base.class.json" missing required "$class" field
Expected: "$class": "entity_base"

This requirement was added in v0.2.0 for refactoring safety.
```

**Cause:**
Schema file doesn't have `"class"` field matching filename.

**Solution:**

1. **Add class field to schema:**
   ```json
   {
     "$schema": "http://json-schema.org/draft-07/schema#",
     "$class": "entity_base",
     "type": "object",
     "properties": {
       ...
     }
   }
   ```

2. **Ensure filename matches:**
   ```
   entity_base.class.json → "$class": "entity_base"
   post.class.json → "$class": "post"
   ```

3. **Automated migration:**
   ```bash
   # Add $class field to all schemas
   for f in classes/*.class.json; do
     name=$(basename "$f" .class.json)
     jq --arg class "$name" '. + {"$class": $class}' "$f" > tmp && mv tmp "$f"
   done
   ```

---

### Error: Circular inheritance

```
Error: Circular inheritance detected
Class "post" inherits from "content" which inherits from "post"
```

**Cause:**
Class inheritance chain loops back to itself.

**Solution:**

1. **Check inheritance chain:**
   ```bash
   struktur info -c classes/
   ```

2. **Break the cycle:**
   ```json
   // post.json
   {
     "$class": "post",
     "$parent": "content"
   }
   
   // content.json
   {
     "$class": "content",
     "$parent": "entity_base"  // Not "post"
   }
   ```

---

### Error: Unknown class

```
Error: Instance "my-post" references unknown class "blog_post"
No class definition found for: blog_post
```

**Cause:**
Instance references class that doesn't exist in class directories.

**Solution:**

1. **Create class definition:**
   ```json
   // classes/blog_post.class.json
   {
     "$class": "blog_post",
     "$parent": "entity_base",
     "title": "",
     "content": "",
     "$schema": {
       "$schema": "http://json-schema.org/draft-07/schema#",
       "type": "object",
       "properties": {
         "title": { "type": "string" },
         "content": { "type": "string" }
       },
       "required": ["title"]
     }
   }
   ```

2. **Fix instance class reference:**
   ```json
   {
     "$id": "my-post",
     "$class": "post",  // Use existing class
     "title": "My Post"
   }
   ```

3. **Verify class directories loaded:**
   ```bash
   struktur info -c classes/
   # Should list all available classes
   ```

---

## Build Errors

### Error: Build directory collision

```
Error: Build directory already exists: build/
Previous build detected. Struktur uses deterministic builds to prevent overwrites.

Solutions:
  1. Use default deterministic mode (automatic hash-based directories)
  2. Delete existing build: rm -rf build/
  3. Use --no-deterministic to allow overwrites
```

**Cause:**
Non-deterministic build targeting existing directory.

**Solution:**

**Option 1: Use deterministic builds (recommended):**
```bash
# Default behavior - creates build/build-<hash>/
struktur build mystack
struktur build mystack  # Safe - creates new hash-based directory
```

**Option 2: Clean build directory:**
```bash
rm -rf build/
struktur build mystack --no-deterministic -b build/
```

**Option 3: Different build directory:**
```bash
struktur build mystack --no-deterministic -b dist/
```

---

### Error: Template render failure

```
Error rendering template: post.html.hbs
ReferenceError: author is not defined
  at Template (post.html.hbs:5)
```

**Cause:**
Template references undefined variable.

**Solution:**

1. **Add missing data to instance:**
   ```json
   {
     "$id": "my-post",
     "$class": "post",
     "title": "My Post",
     "author": "Alice"
   }
   ```

2. **Use default helper:**
   ```handlebars
   <p>Author: {{default author "Anonymous"}}</p>
   ```

3. **Check for property existence:**
   ```handlebars
   {{#if author}}
     <p>By {{author}}</p>
   {{/if}}
   ```

4. **Debug context:**
   ```handlebars
   <!-- See what's available -->
   <pre>{{json this}}</pre>
   ```

---

## Configuration Errors

### Error: Invalid JSON in config file

```
Error parsing struktur.build.json
SyntaxError: Unexpected token } in JSON at position 45
```

**Cause:**
Malformed JSON syntax.

**Solution:**

1. **Validate JSON:**
   ```bash
   # Check syntax
   jq . struktur.build.json
   
   # Or use online validator
   ```

2. **Common JSON mistakes:**
   ```json
   // ❌ Trailing comma
   {
     "classes": ["./classes"],
   }
   
   // ✅ No trailing comma
   {
     "classes": ["./classes"]
   }
   
   // ❌ Comments not allowed
   {
     // This is a comment
     "classes": ["./classes"]
   }
   
   // ✅ No comments in JSON
   {
     "classes": ["./classes"]
   }
   ```

---

### Error: Config file not found

```
Error: Config file not found: struktur.build.json
```

**Cause:**
Config file doesn't exist at expected location.

**Solution:**

1. **Check file exists:**
   ```bash
   ls -la struktur.build.json
   ```

2. **Use explicit path:**
   ```bash
   struktur build --config mystack/struktur.build.json
   ```

3. **Build without config:**
   ```bash
   # Use CLI flags instead
   struktur build -c classes/ -i instances/ -t templates/
   ```

4. **Auto-discovery expects:**
   ```
   mystack/
   ├── struktur.build.json  # Found automatically
   ├── classes/
   ├── instances/
   └── templates/
   ```

---

## Version Errors

### Error: Version mismatch

**Symptom:**
```bash
struktur --version
# Shows: 0.2.0-alpha

npm view @nucleic-se/struktur@alpha version
# Shows: 0.2.3-alpha
```

**Cause:**
Cached or outdated installation.

**Solution:**

1. **Reinstall latest:**
   ```bash
   npm uninstall -g @nucleic-se/struktur
   npm cache clean --force
   npm install -g @nucleic-se/struktur@alpha
   struktur --version  # Should show latest
   ```

2. **Check installation:**
   ```bash
   which struktur
   npm list -g @nucleic-se/struktur
   ```

3. **Use npx for latest:**
   ```bash
   npx @nucleic-se/struktur@alpha build mystack
   ```

---

### Error: Breaking changes after upgrade

**Symptom:**
Build worked before upgrade, now fails with schema errors.

**Solution:**

1. **Check breaking changes:**
   - See [Breaking Changes](breaking-changes.md) for migration guide
   - v0.2.0 requires `"class"` field in schemas
   - v0.2.0 requires strict validation (extra fields warned)

2. **Migrate schemas:**
   ```bash
   # Add $class field to all schemas
   for f in classes/*.class.json; do
     name=$(basename "$f" .class.json)
     jq --arg class "$name" '. + {"$class": $class}' "$f" > tmp && mv tmp "$f"
   done
   ```

3. **Fix extra fields:**
   - Add properties to schema, or
   - Remove properties from instances

---

## Debugging Techniques

### Enable JSON output for machine parsing

```bash
struktur validate mystack --json > validation.json
struktur build mystack --json > build-results.json
```

Parse with jq:
```bash
struktur validate mystack --json | jq '.errors[] | .message'
```

---

### Check what gets loaded

```bash
# See all classes and inheritance
struktur info -c classes/

# See classes from multiple directories
struktur info -c universal/classes mystack/classes
```

---

### Validate before building

```bash
# Always validate first
if struktur validate mystack --quiet; then
  struktur build mystack
else
  echo "Validation failed" >&2
  exit 1
fi
```

---

### Inspect canonical output

```bash
# Generate canonical.json without templates
struktur generate mystack -o debug.json

# Inspect structure
jq '."$instances"[] | {"$id": ."$id", "$class": ."$class"}' debug.json
jq '."$classes_by_id" | keys' debug.json
```

---

### Debug template context

Add to template:
```handlebars
<!-- See full context -->
<pre>{{json this}}</pre>

<!-- See specific sections -->
<pre>
Instances: {{length $instances}}
Classes: {{length $classes}}
</pre>

<!-- Check if property exists -->
{{#if author}}
  Author: {{author}}
{{else}}
  Author property not set
{{/if}}
```

---

### Check paths resolution

```bash
# From inside stack directory
pwd
# /Users/you/mystack

struktur build .
# Paths in struktur.build.json relative to /Users/you/mystack

# From parent directory
cd ..
pwd
# /Users/you

struktur build mystack
# Auto-finds mystack/struktur.build.json
# Paths still relative to /Users/you/mystack (config location)

struktur build -c mystack/classes
# Path relative to /Users/you (CWD)
```

---

### Use quiet mode for automation

```bash
# In scripts
struktur build mystack --quiet
if [ $? -eq 0 ]; then
  echo "Build succeeded"
else
  echo "Build failed" >&2
  exit 1
fi
```

---

### Enable verbose logging (if available)

```bash
# Future: --verbose flag
# Current: Output is verbose by default, use --quiet to suppress
```

---

## Getting Help

### Resources

- [CLI Reference](cli-reference.md) - All commands and flags
- [Helper Reference](helpers-reference.md) - Template helpers
- [Concepts Documentation](INDEX.md#core-concepts) - Deep dives
- [GitHub Issues](https://github.com/nucleic-se/struktur/issues) - Report bugs

### Before reporting bugs

1. **Check version:**
   ```bash
   struktur --version
   node --version
   ```

2. **Minimal reproduction:**
   - Simplify to smallest failing case
   - Include config file and error message
   - Test with `--json` output

3. **Validate first:**
   ```bash
   struktur validate mystack --json
   ```

4. **Include context:**
   - Operating system
   - Struktur version
   - Command that failed
   - Full error output
   - Relevant config/schema files

---

## See Also

- [CLI Reference](cli-reference.md) - Command syntax and options
- [Concepts: Validation](concepts-validation.md) - How validation works
- [Breaking Changes](breaking-changes.md) - Migration guides
- [Tutorial: First Stack](tutorial-first-stack.md) - Step-by-step learning
