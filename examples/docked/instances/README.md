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
  "id": "myapp",
  "class": "docked_container",
  "description": "My application",
  "domains": ["application"],
  "aspects": {
    "docker_container": {
      "image": "myorg/myapp:latest",
      "ports": ["8000:8000"],
      "networks": ["docked"]
    }
  }
}
```

### With Environment Variables
```json
{
  "id": "api",
  "class": "docked_container",
  "aspects": {
    "docker_container": {
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
  "id": "webapp",
  "class": "docked_container",
  "aspects": {
    "docker_container": {
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

See existing files for examples of:
- `image` - Docker image name
- `command` - Override container command
- `working_dir` - Set working directory
- `ports` - Port mappings ["host:container"]
- `volumes` - Volume mounts
- `environment` - Environment variables (use ${VAR} for .env file)
- `networks` - Network attachments
- `depends_on` - Service dependencies
- `restart_policy` - Restart behavior
- `healthcheck` - Health check configuration
- `deploy.resources` - CPU/memory limits

## Workflow

1. Copy an existing container as template
2. Modify `id`, `image`, and other fields
3. Run `struktur build --exact`
4. Test with `cd build && docker compose up -d`
