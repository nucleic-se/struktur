# Docked Full-Stack Application

**Docked** is a complete, production-ready full-stack web application stack generated from canonical data. It demonstrates how all layers of a modern web application work together: frontend, backend API, database, and cache.

**⚠️ Important**: Docked is an **extension** of Universal, not a standalone stack. You must build it with Universal's base classes.

## What You Get

A **working web application** with:

- **Frontend**: Modern single-page app served by Nginx
- **Backend API**: Node.js REST API with 3 endpoints
- **Database**: PostgreSQL for persistent data
- **Cache**: Redis for session/query caching
- **Reverse Proxy**: Nginx routing frontend + API

**Access it at**: http://localhost:8080 after starting the stack

### The Complete Stack

```
User Browser
    ↓
Nginx :8080 (Frontend + Reverse Proxy)
    ↓
Node.js API :3001
    ↓
PostgreSQL :5432  +  Redis :6379
```

### Production Features
- **Multi-environment configs**: Dev/staging/production with secrets management patterns
- **Health checks**: All services monitor themselves and dependencies
- **Resource limits**: CPU and memory constraints ready for production
- **Dependency management**: Services start in correct order (DB → API → Frontend)

### Struktur Capabilities Demonstrated
- **Extending Universal**: Domain-specific classes layer on base vocabulary
- **Multi-output templates**: One model generates compose, configs, and application code
- **Schema validation**: Catches errors before deployment
- **Aspect-based organization**: Docker concerns separated from business logic

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
```

### 6. Open the application

**Visit http://localhost:8080** in your browser

You'll see a working full-stack web app that:
- **Displays** total page views stored in PostgreSQL
- **Shows** cache status (HIT/MISS) from Redis
- **Tracks** new page views with the button (writes to database)
- **Auto-refreshes** stats every 5 seconds

### 7. API Endpoints

Test the backend directly:

```bash
# Health check
curl http://localhost:3001/health

# Get stats (first call = cache MISS, second = HIT)
curl -v http://localhost:3001/stats 2>&1 | grep X-Cache

# Track a page view
curl -X POST http://localhost:3001/track \
  -H "Content-Type: application/json" \
  -d '{"path": "/home"}'
```

Or access via nginx reverse proxy:
- Frontend: http://localhost:8080
- API: http://localhost:8080/api/health

### 8. What Got Generated

The build creates a complete application:

**Frontend**:
- `build/frontend/index.html` - Modern single-page app

**Backend**:
- `build/api/server.js` - Node.js API (health, stats, track endpoints)
- `build/api/package.json` - Dependencies (pg, redis)

**Infrastructure**:
- `build/docker-compose.yml` - All services with health checks and dependencies
- `build/nginx.conf` - Reverse proxy config (frontend + API routing)

**Configuration**:
- `build/.env.development` - Dev environment
- `build/.env.staging` - Staging template
- `build/.env.production` - Production with secrets placeholders

**Documentation**:
- `build/index.html` - Visual stack viewer
- `build/canonical.json` - Full data model

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

- **Containers**: nginx (frontend + proxy), api (Node.js backend), postgres (database), redis (cache)
- **Networks**: docked (bridge network connecting all services)
- **Volumes**: postgres-data, redis-data (persistent storage)
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

## Using This as a Template

### Quick Start: Add Your Own Service

**1. Create a new container instance:**

```bash
cp instances/containers/api.json instances/containers/myapp.json
```

**2. Edit the basics:**

```json
{
  "id": "myapp",
  "class": "docked_container",
  "description": "My custom application",
  "domains": ["application"],
  "aspects": {
    "docker_container": {
      "image": "myorg/myapp:latest",
      "ports": ["8000:8000"],
      "networks": ["docked"],
      "restart_policy": "unless-stopped",
      "environment": {
        "APP_ENV": "${APP_ENV:-development}",
        "DATABASE_URL": "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
      },
      "depends_on": ["postgres"],
      "healthcheck": {
        "test": ["CMD", "curl", "-f", "http://localhost:8000/health"],
        "interval": "15s",
        "timeout": "5s",
        "retries": 3
      }
    }
  }
}
```

**3. Rebuild:**

```bash
struktur build --exact
cd build && docker compose up -d myapp
```

### Common Patterns

**Database container:**
```json
{
  "id": "mongodb",
  "class": "docked_container",
  "domains": ["database"],
  "aspects": {
    "docker_container": {
      "image": "mongo:7",
      "ports": ["27017:27017"],
      "volumes": ["mongo-data:/data/db"],
      "environment": {
        "MONGO_INITDB_ROOT_USERNAME": "${MONGO_USER}",
        "MONGO_INITDB_ROOT_PASSWORD": "${MONGO_PASSWORD}"
      }
    }
  }
}
```

**Worker/background job:**
```json
{
  "id": "worker",
  "class": "docked_container",
  "domains": ["application"],
  "aspects": {
    "docker_container": {
      "image": "myorg/worker:latest",
      "command": "npm run worker",
      "restart_policy": "unless-stopped",
      "depends_on": ["redis", "postgres"],
      "deploy": {
        "resources": {
          "limits": {"cpus": "0.5", "memory": "512M"}
        }
      }
    }
  }
}
```

**Volume for persistence:**
```json
{
  "id": "mongo-data",
  "class": "docked_volume",
  "description": "MongoDB data storage",
  "aspects": {
    "docker_volume": {
      "driver": "local"
    }
  }
}
```

### Environment Variables

Add your variables to `.env.development` (copy from build output):

```bash
# Your app
APP_ENV=development
APP_SECRET=change-me-in-production

# MongoDB (if you added it)
MONGO_USER=admin
MONGO_PASSWORD=dev-password
```

### Remove What You Don't Need

Don't need Grafana? Delete `instances/containers/grafana.json` and rebuild. 

Don't need Redis Commander? Delete `instances/containers/redis-commander.json`.

The stack will regenerate with only what you've defined.

### Multi-Environment Deployment

```bash
# Development
cp .env.development .env
docker compose up -d

# Staging
cp .env.staging .env
# Add real secrets, then:
docker compose up -d

# Production
# Use secrets manager (AWS Secrets Manager, Vault, etc.)
# Never commit .env.production with real secrets!
```

## Customizing (Advanced)

For deeper customization, edit the JSON instances directly:

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
