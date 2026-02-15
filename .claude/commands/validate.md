---
allowed-tools: Bash(pnpm run build:*), Bash(pnpm run lint:*), Bash(pnpm test:*), Bash(npx pnpm:*), Bash(source:*), Bash(docker:*), Bash(curl:*)
description: Run all checks (build, lint, test)
---

Run comprehensive validation. Execute in sequence:

1. **Frontend Build** (includes type checking):
   ```bash
   source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
   ```

2. **Backend Health Check**:
   ```bash
   curl -s http://localhost:8090/health
   ```

3. **Docker Services Status**:
   ```bash
   docker compose -p localai ps
   ```

## Report

Summarize results:
- Frontend Build: PASS/FAIL
- Backend Health: PASS/FAIL
- Docker Services: X running, Y stopped

**Overall: PASS or FAIL**
