# Docked Production Stack

**Docked** demonstrates production-ready Docker infrastructure generated from canonical data. It showcases multi-environment configuration, health checks, resource limits, and real application architecture (database, cache, API, reverse proxy).

**⚠️ Important**: Docked is an **extension** of Universal, not a standalone stack. You must build it with Universal's base classes. Running `struktur validate docked/` alone will fail because Docked's classes inherit from Universal.

## What this shows

### Production Features
- **Multi-environment configs**: Dev/staging/production environment files with secrets management patterns
- **Health checks**: Container health monitoring with proper startup dependencies
- **Resource limits**: CPU and memory constraints for production deployment
- **Real architecture**: PostgreSQL database, Redis cache, Node.js API, Nginx reverse proxy
- **Dependency management**: Services start in correct order (`postgres` → `api` → `nginx`)

### Struktur Capabilities
- **Extending Universal**: Docked layers new classes on top of Universal's base vocabulary
- **Domain modeling**: Aspect-based organization for Docker-specific concerns
- **Multi-output templates**: One canonical model generates compose files, configs, application code
- **Validation**: Schemas ensure port ranges, volume types, and network configs are valid before rendering

## Quick start

### 1. Install Struktur

```bash
npm install -g @nucleic-se/struktur@alpha
```

### 2. Initialize Universal and Docked

From the repository root:

```bash
# Get Universal base
struktur init universal

# Get Docked example  
struktur init --example docked docked
cd docked
```

### 3. Build the stack

Docked includes a `struktur.build.json` config file that references Universal:

```bash
struktur build --exact
```

Or use explicit flags:

```bash
struktur build \
  -c ../universal/classes classes \
  -a ../universal/aspects aspects \
  -i instances \
  -t templates \
  -b build
```

### 4. Install API dependencies

```bash
cd build/api
npm install
cd ..
```

### 5. Launch the stack

```bash
# Use development environment
cp .env.development .env

# Start all services
docker compose up -d

# Watch startup (services start in dependency order)
docker compose logs -f
```

Access the services:
- **Nginx (Frontend)**: http://localhost:8080
- **API**: http://localhost:3001/health or http://localhost:8080/api/health (via nginx)
- **PostgreSQL**: localhost:5432 (user: docked_dev, db: docked_app_dev)
- **Redis**: localhost:6379
- **Grafana**: http://localhost:3000 (admin/dev_grafana_admin)
- **Redis Commander**: http://localhost:8081
- **Whoami**: http://localhost:8082

### 6. Test the API

```bash
# Check API health
curl http://localhost:3001/health

# Track a page view (writes to PostgreSQL)
curl -X POST http://localhost:3001/track \
  -H "Content-Type: application/json" \
  -d '{"path": "/home"}'

# Get stats (reads from PostgreSQL, caches in Redis)
curl http://localhost:3001/stats

# Call again - should return from cache (X-Cache: HIT)
curl -v http://localhost:3001/stats 2>&1 | grep X-Cache
```

### 7. Inspect outputs

The build generates:
- `build/docker-compose.yml` - Complete compose file with health checks, dependencies, resource limits
- `build/.env.development` - Development environment configuration
- `build/.env.staging` - Staging environment template
- `build/.env.production` - Production environment template with secrets management placeholders
- `build/nginx.conf` - Reverse proxy configuration with security headers and caching
- `build/api/server.js` - Node.js API with database and Redis integration
- `build/api/package.json` - API dependencies
- `build/index.html` - Visual catalog of all containers (open in browser)
- `build/canonical.json` - Full merged data model

## Configuration

**struktur.build.json** defines the build:

```json
{
  "classes": ["../universal/classes", "classes"],
  "aspects": ["../universal/aspects", "aspects"],
  "instances": ["instances"],
  "templates": ["templates"],
  "buildDir": "build"
}
```

Paths are relative to the config file. CLI flags override config values.

## What's included

### Classes (domain-specific)

- `docked_container` - Docker container with image, ports, volumes, environment
- `docked_network` - Docker network configuration
- `docked_volume` - Docker volume with driver options
- Aspect classes for docker-specific properties (host, network, storage)
- Domain classes for organizing services by purpose (web, monitoring, storage, etc.)

### Instances (example data)

- **Containers**: nginx, grafana, redis, redis-commander, whoami
- **Networks**: docked (bridge network)
- **Volumes**: grafana-data (persistent storage)
- **Global**: Stack-level metadata and build configuration

### Templates

- `docker-compose.yml` - Main compose file generation
- `cards/container.html` - Container-specific viewer cards
- `.env.example` - Environment variable documentation
- Plus inherited Universal templates (viewer.html, partials)

## Production patterns demonstrated

### Multi-environment configuration
Three environment files (dev/staging/prod) show how to manage configuration across deployment stages:
- **Development**: Full credentials visible, debug logging
- **Staging**: Placeholder for secrets management integration
- **Production**: Explicit secrets manager integration, minimal logging

### Health checks and dependencies
Services define health checks and depend on each other correctly:
```yaml
api:
  depends_on:
    - postgres  # Waits for database
    - redis     # Waits for cache
  healthcheck:
    test: ["CMD", "wget", "http://localhost:3001/health"]
```

### Resource management
Production deployments need resource limits:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.25'
      memory: 256M
```

### Reverse proxy pattern
Nginx acts as a single entry point:
- Static files served directly
- API proxied to backend with headers
- Health checks for container orchestration
- Security headers and caching

## What we learned (Dogfooding Results)

This example was built to **dogfood Struktur** - use it to build real infrastructure and find missing features. Key findings:

### ✅ What works well
1. **Schema validation catches errors early** - Invalid port formats, missing fields detected before deployment
2. **Template flexibility** - Adding health checks, resource limits, complex nested structures works smoothly
3. **Config system is practical** - The new `render` field and flexible naming makes real projects manageable
4. **Aspect layering scales** - Docker-specific aspects layer cleanly on Universal base

### ⚠️ Issues discovered
1. **HTML escaping in templates** - Handlebars escapes `=` to `&#x3D;` in environment variables, breaking some configs
2. **Template complexity for conditionals** - Managing multiple relation types in depends_on requires careful nesting
3. **No template inheritance yet** - Would be useful for nginx configs with base + environment overrides

### 📋 Potential improvements
1. **Environment variable interpolation** - Could pre-process ${VAR} references before rendering
2. **Secret management helpers** - Templates for integrating with AWS Secrets Manager, Vault, etc.
3. **Validation for environment-specific values** - Ensure production configs don't have default passwords

## How layering works

Docked doesn't duplicate Universal—it **extends** it:

```
Universal (base)           Docked (extension)
├── entity_base            ├── docked_container (inherits from entity_base)
├── aspect_base            ├── aspect_docker_container (inherits from aspect_base)
└── domain_root            ├── domain_web (inherits from domain_root)
                           └── ... more domain-specific classes
```

When you build with `-c universal/classes -c docked/classes`, Struktur loads both class directories in order. Docked's classes inherit from Universal's base classes, gaining all the aspect/domain/relation infrastructure without reimplementing it.

## Customizing

Edit instances to model your own containers:

```json
// instances/containers/myapp.json
{
  "id": "myapp",
  "class": "docked_container",
  "label": "My Application",
  "domains": ["domain_application"],
  "aspects": ["aspect_docker_container"],
  "aspect_docker_container": {
    "image": "myorg/myapp:latest",
    "ports": [{"host": 3000, "container": 3000}],
    "environment": {
      "NODE_ENV": "production"
    }
  }
}
```

Then rebuild:

```bash
struktur build \
  -c ../universal/classes -c . \
  -a ../universal/aspects -a aspects \
  -i instances -t templates \
  -b build/docked
```

The generated `docker-compose.yml` will include your new service.

## Stack structure

```
docked/
├── classes/              # Docked-specific class definitions
│   ├── aspects/          # Docker-specific aspects
│   ├── domains/          # Service categorization
│   ├── docked_container.class.json
│   ├── docked_network.class.json
│   └── docked_volume.class.json
├── instances/            # Example data
│   ├── containers/       # Service definitions
│   ├── networks/         # Network configs
│   ├── volumes/          # Volume configs
│   └── global.json       # Stack metadata
└── templates/            # Output generators
    ├── docker-compose.yml
    ├── cards/container.html
    └── .env.example
```

## Next steps

- Explore the Universal example to understand the aspect/domain pattern
- Create your own domain-specific extension like Docked
- See the main README.md for multi-stack composition patterns
