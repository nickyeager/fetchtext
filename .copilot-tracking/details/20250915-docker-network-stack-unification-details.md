<!-- markdownlint-disable-file -->
# Task Details: Docker Network and Compose Stack Unification

## Research Reference

**Source Research**: #file:../research/20250915-docker-network-stack-unification-research.md

## Phase 1: Project name normalization

### Task 1.1: Add `COMPOSE_PROJECT_NAME=local-ai` to root `.env`

Persist the project name so all `docker compose` commands default to the `local-ai` stack.

- Files:
  - `./.env` - Add or update `COMPOSE_PROJECT_NAME=local-ai`
- Success:
  - `docker compose ps` without `-p` shows project name `local-ai`
- Research References:
  - #file:../research/20250915-docker-network-stack-unification-research.md (Project name options)
- Dependencies:
  - None

### Task 1.2: Standardize command usage to `docker compose -p local-ai`

Update scripts and docs in this repo to consistently specify the project name when invoking compose.

- Files:
  - `./start_services.py`
  - `./start-monitoring-services.py`
  - `./start-document-processor.sh`
  - `./README.md`
  - Any other helper invoking `docker compose`
- Success:
  - Grep for `docker compose` shows usage with `-p local-ai` or relies on `.env` project setting
- Research References:
  - #file:../research/20250915-docker-network-stack-unification-research.md (Project name options)
- Dependencies:
  - Task 1.1 (optional if using `-p` directly)

## Phase 2: Default network naming

### Task 2.1: Update root `docker-compose.yml` to set `networks.default.name: local-ai`

Define the default network with fixed name `local-ai` so all services without explicit networks automatically share it.

- Files:
  - `./docker-compose.yml` - Add:
    ```yaml
    networks:
      default:
        name: local-ai
    ```
    and remove/replace previous `networks.local-ai` if defined solely for naming.
- Success:
  - `docker compose -p local-ai config` shows `networks.default.name` as `local-ai`
- Research References:
  - #file:../research/20250915-docker-network-stack-unification-research.md (Default network naming)
- Dependencies:
  - None

### Task 2.2: Migrate `document-processor` to use `networks: default` with alias

Update service `document-processor` to:

```yaml
services:
  document-processor:
    networks:
      default:
        aliases: [document-processor]
```

- Files:
  - `./docker-compose.yml`
- Success:
  - `docker compose -p local-ai config` shows alias under `default` for `document-processor`
- Research References:
  - #file:../research/20250915-docker-network-stack-unification-research.md (Aliases on default)
- Dependencies:
  - Task 2.1

## Phase 3: Auxiliary stacks integration

### Task 3.1: Update `monitoring` compose files to use external `local-ai` default network

Add at the end of each monitoring compose file:

```yaml
networks:
  default:
    name: local-ai
    external: true
```

- Files:
  - `./monitoring/docker-compose.monitoring.yml`
  - `./monitoring/docker-compose.optimized.yml`
- Success:
  - `docker compose -p local-ai -f monitoring/docker-compose.monitoring.yml config` shows default network `local-ai` external
- Research References:
  - #file:../research/20250915-docker-network-stack-unification-research.md (External network for aux stacks)
- Dependencies:
  - None

## Phase 4: Non-recreating activation

### Task 4.1: Start missing services without recreation; attach existing containers to `local-ai`

Run these commands to avoid recreation and connect stragglers:

```bash
# Ensure project uses desired name
docker compose -p local-ai up -d --no-recreate

# Create the network if missing (idempotent)
docker network ls | grep -q "\blocal-ai\b" || docker network create local-ai

# Attach running containers missing the network (example loop)
for c in $(docker ps --format '{{.Names}}'); do
  if ! docker inspect "$c" -f '{{json .NetworkSettings.Networks}}' | grep -q '"local-ai"'; then
    docker network connect local-ai "$c" || true
  fi
done

# Validate membership
docker network inspect local-ai | jq '.Containers' || docker network inspect local-ai
```

- Files:
  - None (operational commands)
- Success:
  - All necessary containers appear under `docker network inspect local-ai`
  - Services healthy (curl checks succeed where applicable)
- Research References:
  - #file:../research/20250915-docker-network-stack-unification-research.md (Non-recreating activation)
- Dependencies:
  - Phase 1 and 2 complete

## Dependencies

- Docker Engine with Compose V2

## Success Criteria

- `docker compose -p local-ai ps` lists all services under the `local-ai` project
- `docker network inspect local-ai` shows all relevant container members
