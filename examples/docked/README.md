# Docked - Docker Stack Example

**Docked** demonstrates a complete Docker-based web application stack generated entirely from canonical data using Struktur. It showcases real-world container orchestration patterns: multi-service dependencies, caching strategies, health checks, and production-ready configuration management.

**⚠️ Important**: Docked is an **extension** of Universal, not a standalone stack. You must build it with Universal's base classes.

## Design Philosophy

This stack is **opinionated and minimal**:

✅ **One obvious way** to structure Docker containers in Struktur  
✅ **Minimal viable example** (not production-hardened)  
✅ **Best practices** baked in (health checks, dependencies, resource limits)  
✅ **Clear tradeoffs** documented (relationship-driven config, dynamic port extraction)

**Not included:**
- Every possible Docker option (keeps examples learnable)
- Production secrets management (you add that)
- Organization-specific conventions

**Use this as:**
- **Learning reference** (understand Struktur patterns)
- **Starting point** (fork and customize)
- **Best practice guide** (see what works)

**Don't expect:**
- Production-ready out of box
- Every use case covered
- Your exact requirements

## Docker Tech Stack

### Container Architecture

Docked orchestrates **4 Docker containers** that work together as a cohesive application:

#### 1. **PostgreSQL** (postgres:16-alpine)
- **Purpose**: Primary data store for application state
- **Container**: `postgres`
- **Port**: `5432`
- **Features**:
  - Persistent volume (`postgres-data:/var/lib/postgresql/data`)
  - Health checks via `pg_isready`
  - Resource limits: 2 CPU cores, 2GB memory max
  - Environment-based configuration (database name, user, password)
- **Dependencies**: None (infrastructure layer)

#### 2. **Redis** (redis:alpine)
- **Purpose**: Cache layer for API response optimization
- **Container**: `redis`
- **Port**: `6379`
- **Features**:
  - AOF persistence (`redis-data:/data`)
  - Password authentication
  - 30-second TTL for todo lists, 10-second TTL for stats
  - Automatic cache invalidation on writes
  - Health checks via `redis-cli ping`
- **Dependencies**: None (infrastructure layer)

#### 3. **Node.js API** (node:20-alpine)
- **Purpose**: REST API backend with cache coordination
- **Container**: `api`
- **Port**: `3001`
- **Endpoints**:
  - `GET /health` - Service health with database/cache status
  - `GET /todos` - List all todos (cached 30s in Redis)
  - `POST /todos` - Create todo (invalidates cache)
  - `PUT /todos/:id` - Update todo (invalidates cache)
  - `DELETE /todos/:id` - Delete todo (invalidates cache)
  - `GET /stats` - Statistics with cache hit rate
- **Features**:
  - Connection pooling to PostgreSQL
  - Smart cache invalidation strategy
  - Tracks cache hits/misses/DB queries
  - Health checks via wget on `/health`
- **Dependencies**: Waits for `postgres` and `redis` to be healthy before starting

#### 4. **Nginx** (nginx:alpine)
- **Purpose**: Reverse proxy and static file server
- **Container**: `nginx`
- **Port**: `8080` (exposed to host)
- **Features**:
  - Serves frontend SPA from `/usr/share/nginx/html`
  - Reverse proxies `/api/*` to Node.js backend
  - Gzip compression
  - Static file caching (1 year for assets)
  - Security headers (X-Frame-Options, X-Content-Type-Options)
  - Health check endpoint
- **Dependencies**: Waits for `api` to be healthy before starting

### Container Interactions

```
┌─────────────────────────────────────────────────────────────┐
│  User Browser → http://localhost:8080                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Nginx Container (:8080)                                    │
│  • Serves frontend HTML/CSS/JS                              │
│  • Proxies /api/* → api:3001                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Node.js API Container (:3001)                              │
│  • Handles REST requests                                    │
│  • Checks Redis cache first                                 │
│  • Queries PostgreSQL on cache miss                         │
│  • Invalidates cache on writes                              │
└─────────────────────────────────────────────────────────────┘
                     ↓           ↓
          ┌──────────┘           └──────────┐
          ↓                                  ↓
┌───────────────────────┐      ┌───────────────────────┐
│  PostgreSQL (:5432)   │      │  Redis (:6379)        │
│  • Stores todos       │      │  • Caches queries     │
│  • ACID transactions  │      │  • 30s/10s TTL        │
│  • Persistent volume  │      │  • Hit rate tracking  │
└───────────────────────┘      └───────────────────────┘
```

### What You Get

A **fully functional collaborative todo list** application demonstrating:

- **CRUD operations**: Create, read, update, delete todos via REST API
- **Smart caching**: Redis caches todo lists (30s) and stats (10s)
- **Cache invalidation**: Writes automatically clear stale cache entries
- **Optimistic updates**: UI updates immediately, rollback on errors
- **Real-time metrics**: Live cache hit rate, DB query count
- **Production patterns**: Health checks, resource limits, dependency ordering

**Access it at**: http://localhost:8080 after starting the stack

### Struktur Capabilities Demonstrated

- **Extending Universal**: Domain-specific aspect_docker_container classes build on universal base
- **Aspect defaults**: Common configuration (networks, restart_policy, healthcheck defaults) defined once in class, inherited by all instances
- **Multi-output templates**: One canonical model generates docker-compose.yml, nginx.conf, API code, and frontend
- **Smart template escaping**: Triple-stash `{{{...}}}` prevents HTML entity encoding in configs
- **Relationship-driven config**: Container dependencies automatically generate `depends_on` chains
- **Schema validation**: Catches configuration errors before deployment
- **Aspect-based organization**: Docker concerns (ports, volumes, env vars) separated from business logic
- **DRY configuration**: Single source of truth eliminates duplication across instances

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

### 4. Launch the stack

```bash
cd build

# Use development environment
cp .env.development .env

# Start all services
docker compose up -d
```

API dependencies install automatically on first container startup (takes ~30 seconds).

### 5. Open the application

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
- `nginx.conf` - Nginx reverse proxy configuration
- `api/server.js` - Node.js REST API with PostgreSQL and Redis
- `frontend.html` - Interactive todo list frontend
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

**Recommended approach:** Use external instances folder to avoid modifying the docked stack.

**1. Create your custom instances:**

```bash
mkdir -p my-services/containers
```

**2. Define your service:**

```bash
cat > my-services/containers/myapp.json << 'EOF'
{
  "$id": "myapp",
  "$class": "docked_container",
  "description": "My custom application",
  "domains": ["application"],
  "$aspects": {
    "aspect_docker_container": {
      "image": "myorg/myapp:latest",
      "ports": ["8000:8000"],
      "environment": {
        "APP_ENV": "${APP_ENV:-development}",
        "DATABASE_URL": "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
      },
      "depends_on": ["postgres"],
      "healthcheck": {
        "test": ["CMD", "curl", "-f", "http://localhost:8000/health"],
        "interval": "15s"
      }
    }
  }
}
EOF
```

**Note:** Common fields like `networks: ["docked"]`, `restart_policy: "unless-stopped"`, and default healthcheck values (`interval`, `timeout`, `retries`) are inherited from the `docked_container` class via `$aspect_defaults`. You only need to specify what's unique to your service.
```

**3. Build with both instance folders:**

```bash
struktur build \
  -c ../universal/classes classes \
  -a ../universal/aspects aspects \
  -i instances \
  -i my-services \
  -t templates \
  -b build

cd build && docker compose up -d myapp
```

**Alternative:** Modify docked instances directly (simpler but less maintainable):

```bash
cp instances/containers/api.json instances/containers/myapp.json
# Edit myapp.json, then:
struktur build --exact
cd build && docker compose up -d myapp
```

### Common Patterns

**Database container:**
```json
{
  "$id": "mongodb",
  "$class": "docked_container",
  "domains": ["database"],
  "$aspects": {
    "aspect_docker_container": {
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
  "$id": "worker",
  "$class": "docked_container",
  "domains": ["application"],
  "$aspects": {
    "aspect_docker_container": {
      "image": "myorg/worker:latest",
      "command": "npm run worker",
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
  "$id": "mongo-data",
  "$class": "docked_volume",
  "description": "MongoDB data storage",
  "$aspects": {
    "aspect_docker_volume": {
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

Don't need the API? Delete `instances/containers/api.json` and update nginx to serve only static files.

Don't need todos? Modify the API to implement different endpoints and update the frontend.

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
  "$id": "myapp",
  "$class": "docked_container",
  "label": "My Application",
  "domains": ["domain_application"],
  "$aspects": ["aspect_docker_container"],
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
    ├── nginx.conf
    ├── api/server.js
    └── frontend.html
```

## Next steps

- Explore the Universal example to understand the aspect/domain pattern
- Create your own domain-specific extension like Docked
- See the main README.md for multi-stack composition patterns
