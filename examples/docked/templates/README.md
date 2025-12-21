# Docked Templates

This directory contains Handlebars templates that generate the complete Docker stack from canonical instance data. The templates transform structured JSON into production-ready configuration files, application code, and deployment artifacts.

## Template Files

### Docker Infrastructure

#### `docker-compose.yml`
**Generates**: Complete Docker Compose configuration for multi-container orchestration

**Input**: Instances with `$aspects.docker_container`, `$aspects.docker_network`, or `$aspects.docker_volume`

**Key Features**:
- Service definitions with image, ports, volumes, environment variables
- Health checks with intervals, timeouts, retries
- Resource limits (CPU, memory)
- Dependency ordering via `depends_on`
- Network configuration
- Volume definitions

**Critical Pattern**: Uses triple-stash `{{{...}}}` for environment variables and commands to prevent HTML entity escaping:
```handlebars
environment:
  DATABASE_URL: "{{{this}}}"  # Correct: preserves := syntax
  # NOT: "{{this}}"            # Wrong: escapes = to &#x3D;
```

**Template Logic**:
```handlebars
{{#each $instances}}
  {{#if $aspects.docker_container}}
    {{id}}:
      image: {{{$aspects.docker_container.image}}}
      {{#if $aspects.docker_container.depends_on}}
      depends_on:
        {{#each $aspects.docker_container.depends_on}}
        - {{this}}
        {{/each}}
      {{/if}}
  {{/if}}
{{/each}}
```

#### `nginx.conf`
**Generates**: Production-ready Nginx reverse proxy configuration

**Features**:
- Reverse proxy to API backend (`/api/*` → `http://api:3001`)
- Static file serving with long-term caching
- Gzip compression
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Health check endpoint
- Proper timeouts and buffer sizes

**Production Patterns**:
```nginx
# API reverse proxy
location /api/ {
    proxy_pass http://api_backend/;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# Static file caching
location ~* \.(jpg|jpeg|png|gif|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Application Code

#### `api/server.js`
**Generates**: Complete Node.js REST API server with PostgreSQL and Redis integration

**Endpoints**:
- `GET /health` - Service health with database/Redis status and metrics
- `GET /todos` - List all todos (cached 30s in Redis)
- `POST /todos` - Create todo (validates input, invalidates cache)
- `PUT /todos/:id` - Update todo completion status
- `DELETE /todos/:id` - Delete todo (with confirmation)
- `GET /stats` - Statistics (cached 10s, includes cache hit rate)

**Integration Patterns**:
```javascript
// Smart caching with invalidation
const cached = await redisClient.get(CACHE_KEYS.allTodos);
if (cached) {
  stats.cacheHits++;
  return cached; // Cache hit
}

// Cache miss - query database
stats.cacheMisses++;
stats.dbQueries++;
const result = await dbClient.query('SELECT * FROM todos');
await redisClient.setEx(CACHE_KEYS.allTodos, 30, JSON.stringify(result));

// Invalidate on writes
await invalidateCaches(); // Clears all todo-related caches
```

**Metrics Tracking**:
- Cache hits/misses count
- Database query count
- Cache hit rate percentage
- Service uptime

#### `api/package.json`
**Generates**: NPM dependencies for the API server

**Dependencies**:
- `pg` (^8.11.3) - PostgreSQL client with connection pooling
- `redis` (^4.6.12) - Redis client with async/await support

### Frontend

#### `frontend.html`
**Generates**: Single-page application with real-time todo management

**Features**:
- Interactive todo list with CRUD operations
- Optimistic UI updates (instant feedback, rollback on errors)
- Auto-refresh every 10 seconds
- Animated counters for statistics
- Toast notifications for user feedback
- Cache status indicator (HIT/MISS badges)
- Responsive design (mobile-friendly)
- Loading states and error handling

**JavaScript Patterns**:
```javascript
// Optimistic update
async function toggleTodo(id, completed) {
  // Update UI immediately
  const todo = todos.find(t => t.id === id);
  todo.completed = completed;
  renderTodos();

  try {
    await fetch(`/api/todos/${id}`, { method: 'PUT', ... });
    showToast('✓ Todo updated!', 'success');
  } catch (error) {
    // Revert on error
    todo.completed = !completed;
    renderTodos();
    showToast(`✗ ${error.message}`, 'error');
  }
}
```

**Animation Strategy**:
- Initial page load: Staggered animations for visual hierarchy
- New items: Slide-in animation only for newly added todos
- Auto-refresh: No animation (avoids distracting re-renders)
- Hover effects: Smooth transitions on interaction

### Environment Configuration

#### `.env.development`
**Generates**: Development environment variables with sensible defaults

**Includes**:
- Database connection strings
- Redis passwords
- API secrets
- Log levels

**Pattern**: Uses simple passwords for local development:
```bash
POSTGRES_PASSWORD=dev_password_change_me
REDIS_PASSWORD=dev_redis_password_change_me
```

#### `.env.staging` / `.env.production`
**Generates**: Production environment templates with secret placeholders

**Pattern**: Documents secret management integration:
```bash
POSTGRES_PASSWORD=REPLACE_WITH_VAULT_SECRET
# Examples:
# - AWS Secrets Manager: $(aws secretsmanager get-secret-value ...)
# - HashiCorp Vault: $(vault kv get -field=password ...)
# - Kubernetes Secrets: mounted as environment variables
```

## How Templates Work

### Build Process

1. **Struktur reads instances**: All `*.json` files in `instances/`
2. **Schema validation**: Ensures data matches class definitions
3. **Data merging**: Combines instances, relations, and global config
4. **Template rendering**: Processes each template with canonical data
5. **Output writing**: Writes generated files to `build/` directory

### Template Context

Templates receive the full canonical data model:

```javascript
{
  instances: [
    { id: "postgres", class: "docked_container", aspects: {...}, ... },
    { id: "redis", class: "docked_container", aspects: {...}, ... },
    // ...
  ],
  relations: {
    "manages/managed_by": [
      { source: "api", target: "postgres" },
      // ...
    ]
  },
  global: {
    stack_name: "Docked Todo Application",
    // ...
  }
}
```

### Handlebars Helpers

**Built-in helpers used**:
- `{{#each array}}...{{/each}}` - Iterate over arrays
- `{{#if condition}}...{{/if}}` - Conditional rendering
- `{{@key}}` / `{{this}}` - Access current iteration key/value
- `{{{unescaped}}}` - Prevent HTML entity encoding (critical for configs)

**Custom filtering**:
```handlebars
{{#each $instances}}
  {{#if $aspects.docker_container}}
    # Only processes container instances
  {{/if}}
{{/each}}
```

## Template Best Practices

### ⚠️ CRITICAL: HTML Escaping

**Always use `{{{...}}}` (triple-stash) for:**
- Environment variables (contain `=`, `:`, `@`)
- Commands (contain `=`, quotes, operators)
- URLs (contain `://`, `&`)
- Any value with special characters

```handlebars
✅ CORRECT
command: {{{$aspects.docker_container.command}}}
environment:
  {{@key}}: "{{{this}}}"

❌ WRONG - Gets HTML escaped
command: {{$aspects.docker_container.command}}
# Result: sh -c &#x27;npm install&#x27; (BROKEN!)
```

**See:** [../../docs/concepts-templates.md](../../docs/concepts-templates.md) for complete escaping guide.

### Other Best Practices

**1. Quote environment values:**
```handlebars
{{@key}}: "{{{this}}}"  # Always quote
```

**2. Check before iterating:**
```handlebars
{{#if $aspects.docker_container.volumes}}
{{#if (gt $aspects.docker_container.volumes.length 0)}}
volumes:
{{#each $aspects.docker_container.volumes}}
  - {{this}}
{{/each}}
{{/if}}
{{/if}}
```

**3. Add educational comments:**
```handlebars
# Services start in dependency order:
#   1. postgres, redis (infrastructure)
#   2. api (backend - waits for DB & cache)
```

**4. Use conditionals for optional sections:**
```handlebars
{{#if $aspects.docker_container.healthcheck}}
healthcheck:
  test: {{$aspects.docker_container.healthcheck.test}}
{{/if}}
```

## Extending Templates

### Adding New Templates

1. **Create template file**: `templates/my-artifact.ext`
2. **Update global.json**: Add to `render` array
3. **Build and verify**: Check `build/` directory

Example:
```json
// instances/global.json
{
  "render": [
    "docker-compose.yml",
    "frontend.html",
    "my-artifact.ext"  // New template
  ]
}
```

### Override Patterns

Templates can be layered (Docked extends Universal):
- Universal provides base templates
- Docked adds domain-specific templates
- Use same filename to override parent template

### Common Extensions

**Health check scripts**:
```handlebars
#!/bin/bash
{{#each $instances}}
{{#if $aspects.docker_container.healthcheck}}
echo "Checking {{id}}..."
docker exec {{id}} {{$aspects.docker_container.healthcheck.test}}
{{/if}}
{{/each}}
```

**Monitoring configs**:
```handlebars
scrape_configs:
  {{#each $instances}}
  {{#if $aspects.docker_container.ports}}
  - job_name: '{{id}}'
    static_configs:
      - targets: ['{{id}}:{{$aspects.docker_container.ports.[0]}}']
  {{/if}}
  {{/each}}
```

## Troubleshooting

### Template Rendering Issues

**Problem**: Environment variables broken (e.g., `:-` becomes `&#x3D;`)  
**Solution**: Use `{{{...}}}` instead of `{{...}}`

**Problem**: Empty sections in output  
**Solution**: Wrap in `{{#if}}` conditionals

**Problem**: Template not generating  
**Solution**: Check `render` array in `instances/global.json`

### Debugging Tips

1. **Check canonical output**: Look at `build/canonical/` for raw data
2. **Validate instances**: Run `struktur build` to see schema errors
3. **Test template logic**: Use small test instances
4. **Compare outputs**: Diff generated files after changes

## Related Documentation

- **Main README**: `../README.md` - Stack overview and quick start
- **Instance README**: `../instances/README.md` - How to create instances
- **Universal docs**: Documentation for base classes and aspects
- **Struktur docs**: Core template engine documentation
