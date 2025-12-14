<!-- markdownlint-disable-file -->
# Research: Docker Network and Compose Stack Unification (local-ai)

This research consolidates verified approaches to ensure all project services run under a single Docker Compose project (stack) named `local-ai` and share a common Docker network named `local-ai`, while avoiding recreation of already-running containers wherever possible.

## Project Structure and Relevant Compose Files

- Root compose files:
  - `docker-compose.yml` (primary)
  - `docker-compose.override.yml` (if present and loaded implicitly)
  - `docker-compose.override.private.yml` (ports localization)
  - `docker-compose.override.public.yml` (resets non-essential ports)
  - `docker-compose.override.public.supabase.yml` (resets non-essential ports)
- Monitoring compose files:
  - `monitoring/docker-compose.monitoring.yml`
  - `monitoring/docker-compose.optimized.yml`

Observed highlights from `docker-compose.yml`:
- Defines many services (Flowise, Open WebUI, n8n, Qdrant, Neo4j, Caddy, Langfuse components, ClickHouse, MinIO, Postgres, Redis/Valkey, Searxng, Ollama variants, Admin Dashboard, Document Processor, Supabase components like db, kong, auth, rest, realtime, storage, imgproxy, meta, studio).
- Currently declares a custom network:
  ```yaml
  networks:
    local-ai:
      name: local-ai
  ```
  and assigns `document-processor` explicitly to that network with an alias, while most other services do not specify `networks`. Those services will default to the implicitly created project default network (e.g., `local-ai_default` when using `-p local-ai`), not the explicitly declared `local-ai` network.

Implication: Not all services are guaranteed to be on the same user-defined `local-ai` network unless either:
1) Every service is explicitly attached to `networks: [local-ai]`, or
2) The default network is renamed to `local-ai` so services without explicit network config also join it.

## Goal

Unify all running services to:
- Compose project (stack) name: `local-ai`
- Default network name: `local-ai`

Constraints:
- Do not recreate running services unless necessary. Prefer connecting running containers to the `local-ai` network or starting missing services without recreation.

## Verified Techniques and Commands

### 1) Standardize Compose Project Name

Use a consistent Compose project name to ensure resource naming cohesion:

- Option A: Set environment variable in the repo’s root `.env` (loaded by `docker compose`):
  ```bash
  COMPOSE_PROJECT_NAME=local-ai
  ```
- Option B: Always pass `-p local-ai` to `docker compose` commands.

References:
- Docker Compose v2 docs: Project name via `-p` and `COMPOSE_PROJECT_NAME` (official docs)

### 2) Make the Default Network Named `local-ai`

To avoid annotating every service, set the Compose default network name to `local-ai`. Example patch for root `docker-compose.yml`:

```yaml
networks:
  default:
    name: local-ai
```

Then, for services that need aliases (e.g., `document-processor`), use:

```yaml
services:
  document-processor:
    # ...
    networks:
      default:
        aliases:
          - document-processor
```

Result:
- All services without an explicit network declaration join `local-ai` automatically.
- Services needing aliases can still define them under `default`.

References:
- Docker Compose networking docs: custom default network with a fixed `name`.

### 3) Avoid Recreating Running Services

When applying compose updates, bring up services without recreation:

```bash
docker compose -p local-ai up -d --no-recreate
```

To start only missing (stopped/not created) services:

```bash
docker compose -p local-ai up -d --no-recreate <service1> <service2> ...
```

If a service definition changes and you must not recreate it, prefer attaching the current container to the desired network using the Docker CLI:

```bash
# Create network if it does not already exist
docker network ls | grep -q "\blocal-ai\b" || docker network create local-ai

# Attach a running container that is not on the network
docker network connect local-ai <container_name>

# Verify membership
docker network inspect local-ai | jq -r '.Containers | keys[]?' | grep <container_name>
```

Note: If a container already has the desired network, `docker network connect` will error; detect membership first or ignore non-zero exit as benign.

### 4) Ensure Auxiliary Compose Files Use the Same Network

For standalone compose files (e.g., in `monitoring/`) that may be invoked separately, enforce the same default network without creating a new one by marking it external:

```yaml
networks:
  default:
    name: local-ai
    external: true
```

Invoke with the same project name to avoid divergent stacks:

```bash
docker compose -p local-ai -f monitoring/docker-compose.monitoring.yml up -d --no-recreate
```

This connects monitoring services to the existing `local-ai` network and the same Compose project.

References:
- Docker Compose: using external networks; multiple compose files and project name alignment.

### 5) Validating State

Commands to audit project and network state:

```bash
# List services and state under the project
docker compose -p local-ai ps

# Inspect the network membership
docker network inspect local-ai | jq '.Containers'

# Check container networks
docker inspect -f '{{json .NetworkSettings.Networks}}' <container_name> | jq

# Sanity HTTP health checks (examples)
curl -sf http://localhost:8090/health
curl -sf http://localhost:8000/auth/v1/health || true
```

### 6) Interaction with Overrides

The override files in this repo adjust public port exposure. They do not set networks. Setting the default network name in the primary compose file propagates to the effective config, so additional network directives in overrides are generally unnecessary.

If any override introduces a conflicting `networks` section, ensure it also points `default` to the named `local-ai` network.

## Implementation Guidance

1. Add `COMPOSE_PROJECT_NAME=local-ai` to the repo’s root `.env` to default all future compose invocations to the desired project.
2. Update `docker-compose.yml` to rename the default network to `local-ai` and migrate any explicit references (e.g., `document-processor`) to use `networks: default` with aliases as needed.
3. For `monitoring/docker-compose.*.yml`, declare `networks.default` with `name: local-ai` and `external: true` so they join the shared network and avoid network recreation.
4. Start any missing services with `docker compose -p local-ai up -d --no-recreate` to avoid recreating working containers.
5. For already running containers that are not yet on `local-ai`, run `docker network connect local-ai <container>`.
6. Validate via `docker compose -p local-ai ps` and `docker network inspect local-ai`.

## Risks and Edge Cases

- If the default network is renamed while containers are running, Compose may attempt to (re)create networks on next `up`. Prefer attaching existing containers with `docker network connect` to avoid downtime, then progressively update compose files.
- Services depending on legacy network aliases may require explicit aliases on the `default` network once the rename is applied.
- External tools/scripts may assume the old default network name (e.g., `local-ai_default`). Update any such scripts accordingly.
- If multiple compose commands are run from different directories, ensure they all use `-p local-ai` and that their `networks.default` points to `local-ai` (external for aux stacks).

## External References (for verification)

- Docker Compose V2: Project name (`-p`, `COMPOSE_PROJECT_NAME`) — Official docs
- Docker Compose Networking: default network customization and external named networks — Official docs
- Docker CLI: `docker network connect`, `docker network inspect` — Official docs
