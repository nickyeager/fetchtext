# 20251117 Password Alignment Plan

## Problem Statement
Supabase-related services across Docker Compose, Azure deployments, and documentation still refer to legacy `POSTGRES_PASSWORD` samples that no longer match the desired runtime value. The user has rotated the underlying database role passwords and needs every tracked reference (docs, plans, configs) updated to the new canonical value (`***REMOVED-POSTGRES-PASSWORD-2***`) so both local and cloud environments stay in sync. Until the repo reflects the new passwords, operators risk boot failures (GoTrue/PostgREST authentication) and confusion when reproducing recovery procedures.

## Current Implementation Analysis
- `.env` stores the sample secrets that the compose stack consumes locally; only `POSTGRES_PASSWORD` needs to change but it propagates to authenticator/supabase_auth_admin and other internal roles.
- `memory/SUPABASE_MIGRATION_PLAN.md` embeds the old password in multiple `docker run` examples and recovery steps.
- Azure artifacts (Bicep, parameters) already reference Key Vault secrets, but the docs describing password rotation do not mention the concrete updated values.
- No additional source files hardcode the password, yet developers rely on the documented reference when rebuilding containers or running ad-hoc `docker run` commands.

## Proposed Solution
1. Collect the exact password strings the user wants published for the local/dev context (even if they remain samples) and treat them as the new canonical references.
2. Replace the legacy password in `.env`, `.env.example` (if required for onboarding), and `memory/SUPABASE_MIGRATION_PLAN.md` to prevent drift.
3. Document a short operational checklist describing how to apply the new passwords to the Azure VM/Key Vault and ensure running containers use the updated credentials.
4. Verify via repository-wide search that no files still include the old password string.

## Implementation Steps
1. **Gather Inputs**: Confirm the final password(s) (POSTGRES/authenticator/supabase_auth_admin) either from the user or from secure storage; note whether `.env.example` must also be updated. _Dependency_: user confirmation.
2. **Update Documentation & Plans**: Edit `memory/SUPABASE_MIGRATION_PLAN.md` (and any other docs referencing the old value) to include the new password, ensuring formatting remains consistent.
3. **Update Environment Files**: Modify `.env` (and `.env.example` if requested) so local Docker Compose pulls the new password, and annotate instructions if necessary.
4. **Operational Guidance**: Add or update documentation outlining how to push the new password to Azure Key Vault and restart the Supabase containers/VM stack so authentication succeeds.
5. **Validation**: Run a repo-wide search for the old password string to confirm no references remain; record completion details in `Copilot-Processing.md`.

## Success Criteria
- The previous password value no longer appears anywhere in the repository.
- `.env`, documentation, and migration plans all reference the new password string(s).
- Operators have clear instructions for syncing the password to Azure Key Vault and the VM Docker stack.
- `Copilot-Processing.md` reflects the completed action items for traceability.
