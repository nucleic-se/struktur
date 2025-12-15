# Docked Example Stack

**Docked** demonstrates how to extend Universal for Docker container modeling. It adds domain-specific classes for containers, networks, and volumes, then generates docker-compose.yml and related configuration from canonical data.

**⚠️ Important**: Docked is an **extension** of Universal, not a standalone stack. You must build it with Universal's base classes. Running `struktur validate docked/` alone will fail because Docked's classes inherit from Universal.

## What this shows

- **Extending Universal**: Docked layers new classes on top of Universal's base vocabulary
- **Domain modeling**: Aspect-based organization for Docker-specific concerns
- **Multi-output templates**: One canonical model generates compose files, env templates, deployment scripts
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
struktur build
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
cp .env.example .env
# Edit .env with your desired passwords
docker compose up -d
```

Access the services:
- **Nginx**: http://localhost:8080
- **Grafana**: http://localhost:3000 (admin/your-password)
- **Redis Commander**: http://localhost:8081

### 5. Inspect outputs

The build generates:
- `build/docker-compose.yml` - Complete compose file with all services
- `build/.env.example` - Environment variable template
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
