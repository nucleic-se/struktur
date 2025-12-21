# Docked Stack - Instance Template

This directory contains instance definitions for your Docker services.

## File Structure

```
instances/
├── containers/     # Docker containers (services)
├── networks/       # Docker networks
├── volumes/        # Docker volumes
└── global.json     # Stack-level config
```

## Quick Examples

### Minimal Container
```json
{
  "$id": "myapp",
  "$class": "docked_container",
  "description": "My application",
  "domains": ["application"],
  "$aspects": {
    "aspect_docker_container": {
      "image": "myorg/myapp:latest",
      "ports": ["8000:8000"]
    }
  }
}
```

**Note:** `networks: ["docked"]` and `restart_policy: "unless-stopped"` are inherited automatically from the `docked_container` class defaults.

### With Environment Variables
```json
{
  "$id": "api",
  "$class": "docked_container",
  "$aspects": {
    "aspect_docker_container": {
      "image": "node:20-alpine",
      "environment": {
        "NODE_ENV": "${NODE_ENV:-development}",
        "DATABASE_URL": "postgresql://user:pass@postgres:5432/db"
      }
    }
  }
}
```

### With Dependencies
```json
{
  "$id": "webapp",
  "$class": "docked_container",
  "$aspects": {
    "aspect_docker_container": {
      "image": "nginx:alpine",
      "depends_on": ["api"],
      "healthcheck": {
        "test": ["CMD", "wget", "--spider", "http://localhost/health"],
        "interval": "10s"
      }
    }
  }
}
```

## Available Fields

### Automatically Inherited (via $aspect_defaults)

All `docked_container` instances automatically inherit:
- `networks: ["docked"]` - Attached to the docked network
- `restart_policy: "unless-stopped"` - Restarts on failure but not on manual stop
- `healthcheck.interval: "10s"` - Check every 10 seconds
- `healthcheck.timeout: "5s"` - 5 second timeout
- `healthcheck.retries: 5` - Retry 5 times before unhealthy

**You only need to specify these if you want to override the defaults.**

### Required Fields

- `image` - Docker image name (required)

### Optional Fields

See existing files for examples of:
- `command` - Override container command
- `working_dir` - Set working directory
- `ports` - Port mappings ["host:container"]
- `volumes` - Volume mounts
- `environment` - Environment variables (use ${VAR} for .env file)
- `depends_on` - Service dependencies
- `healthcheck.test` - Health check command (overrides defaults for interval/timeout/retries)
- `deploy.resources` - CPU/memory limits

## Workflow

1. Copy an existing container as template
2. Modify `$id`, `image`, and other fields
3. Run `struktur build --exact`
4. Test with `cd build && docker compose up -d`