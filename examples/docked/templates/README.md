# Docked Templates

This folder holds the templates Docked uses when it builds on top of Universal. Struktur merges Universal's base templates with these Docked-specific ones, then renders everything into the build directory so you can inspect the outputs.

## What’s here
- `docker-compose.yml` — renders services, networks, and volumes from instances that carry `aspects.docker_container`, `aspects.docker_network`, or `aspects.docker_volume`.
- `.env.example` — environment variable template for Docker Compose. Copy to `.env` and set your values. Docker Compose automatically loads `.env` from the same directory as `docker-compose.yml`.
- `nginx-index.html` — static HTML page served by the nginx container, providing a terminal-style view of the Docker infrastructure.
- `grafana-datasources.yml` — example datasource config derived from instances tagged with the Grafana aspect.
- `cards/` — partials that adjust how Universal’s cards render for Docker concepts.

## How generation works
- Build with `struktur build -c ../universal/classes -c docked/classes -a ../universal/aspects -a docked/aspects -i docked/instances -t docked/templates -b build/docked` so Docked augments the Universal base instead of replacing it.
- Struktur validates and merges the data, then renders these templates into the build directory alongside canonical JSON outputs.
- The viewer and Compose file both rely on deterministic ordering and namespacing (aspects/domains/kinds) established by Universal; Docked only supplies domain-specific fields and presentation.

## Extending or reusing
- Add new templates here to emit other artifacts (scripts, manifests, docs) for your Docker model.
- Override Universal base templates by mirroring their relative paths and filenames; Struktur’s precedence rules ensure your version wins without mutating the base.
- Stick to the existing aspect and relation names (or update the classes and schemas accordingly) to keep renders predictable.
- Treat the generated bundle as disposable: rerun builds freely and diff the hashed outputs when you change data or templates.
