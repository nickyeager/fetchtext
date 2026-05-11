---
allowed-tools: Read, Glob
description: Prime agent with codebase context
---

Read these files to understand the codebase before starting work:

1. `CLAUDE.md` - Commands, patterns, and conventions
2. `package.json` - Scripts and dependencies
3. `tsconfig.json` - TypeScript strict settings
4. `docker-compose.yml` - Service orchestration
5. `document-processor/app/config/settings.py` - Backend configuration
6. `dashboard/src/lib/supabase.ts` - Supabase client setup
7. `dashboard/src/lib/supabase-auth-utils.ts` - Auth utilities

Then run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd dashboard && npx pnpm build
```

Confirm all checks pass before proceeding.
