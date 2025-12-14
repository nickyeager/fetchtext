---
applyTo: '.copilot-tracking/changes/20250915-docker-network-stack-unification-changes.md'
---
<!-- markdownlint-disable-file -->
# Task Checklist: Docker Network and Compose Stack Unification

## Overview

Ensure every dependency runs under the same Compose project (`local-ai`) and the same Docker network (`local-ai`), starting only missing services and connecting existing ones without recreation.

## Objectives

- Standardize the Compose project name to `local-ai` across all invocations
- Set the default network name to `local-ai` so all services share it

## Research Summary

### Project Files
- docker-compose.yml - Primary orchestrator; many services defined with a custom `local-ai` network and some without explicit networks
- docker-compose.override.private.yml - Localhost-only port bindings
- docker-compose.override.public.yml - Resets non-essential ports
- docker-compose.override.public.supabase.yml - Resets non-essential ports for supabase
- monitoring/docker-compose.monitoring.yml - Monitoring stack
- monitoring/docker-compose.optimized.yml - Optimized monitoring stack

### External References
- #file:../research/20250915-docker-network-stack-unification-research.md - Techniques to unify network and project naming without recreation

### Standards References
- #file:../../.github/instructions/copilot-instructions.md - Repo policy alignment

## Implementation Checklist

### [ ] Phase 1: Project name normalization

- [ ] Task 1.1: Add `COMPOSE_PROJECT_NAME=local-ai` to root `.env`
  - Details: .copilot-tracking/details/20250915-docker-network-stack-unification-details.md (Lines 20-50)

- [ ] Task 1.2: Standardize command usage to `docker compose -p local-ai`
  - Details: .copilot-tracking/details/20250915-docker-network-stack-unification-details.md (Lines 52-78)

### [ ] Phase 2: Default network naming

- [ ] Task 2.1: Update root `docker-compose.yml` to set `networks.default.name: local-ai`
  - Details: .copilot-tracking/details/20250915-docker-network-stack-unification-details.md (Lines 80-128)

- [ ] Task 2.2: Migrate `document-processor` to use `networks: default` with alias
  - Details: .copilot-tracking/details/20250915-docker-network-stack-unification-details.md (Lines 130-168)

### [ ] Phase 3: Auxiliary stacks integration

- [ ] Task 3.1: Update `monitoring` compose files to use external `local-ai` default network
  - Details: .copilot-tracking/details/20250915-docker-network-stack-unification-details.md (Lines 170-230)

### [ ] Phase 4: Non-recreating activation

- [ ] Task 4.1: Start missing services without recreation; attach existing containers to `local-ai`
  - Details: .copilot-tracking/details/20250915-docker-network-stack-unification-details.md (Lines 232-300)

## Dependencies

- Docker Engine with Compose V2
- jq (optional for JSON inspection)

## Success Criteria

- `docker compose -p local-ai ps` shows all services under the `local-ai` project
- `docker network inspect local-ai` lists all relevant containers