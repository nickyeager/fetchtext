<!-- markdownlint-disable-file -->
# Supabase Environments

## Overview

This repository historically relied on the local Docker Compose stack under `supabase/` for both development and production-style testing. Azure production now moves to a **managed Supabase project** so we inherit high availability Postgres, automatic backups, and operational support while keeping the docker stack strictly for local development.

## Local Development (Docker Compose)

- Continue using `docker compose --profile supabase up -d` from the repo root when you need the embedded services (Postgres, Kong, GoTrue, storage, realtime, etc.).
- Secrets for the local stack still live in the root `.env`; rotate them any time the managed project receives new credentials so tests stay aligned.
- Treat any data inside `supabase_postgres_data_new` as disposable; **do not** copy production data back into the local stack.

## Managed Supabase for Azure

Production, staging, and other cloud-hosted environments must use a hosted Supabase project. Key requirements:

1. **Project Provisioning**
	- Create the project inside the FetchText Supabase organization.
	- Choose the same region as the Azure workload (e.g., `us-east-1`) to minimize latency.
	- Immediately rotate all generated keys (anon/service/JWT/POSTGRES_PASSWORD) because the defaults are published in this repository from the legacy stack.

2. **Secrets Capture**
	Record the following values (store them securely; never commit to git):
	- `SUPABASE_URL` (https://<project-ref>.supabase.co)
	- `SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- Postgres connection string (full URI including `?pgbouncer=true&connect_timeout=10` if using Supavisor)
	- Storage S3 credentials if object storage is enabled

3. **Key Vault Storage**
	- All values above must be written to Azure Key Vault secrets before deployment (`supabase-url`, `supabase-anon-key`, `supabase-service-role`, `supabase-db-connection`).
	- Deployment pipelines read from Key Vault instead of `.env` once Task 1.2 is complete.

4. **Network Access**
	- Enable the “Require JWT” and “PITR/Backups” features in Supabase settings.
	- Restrict PostgREST/Database access to the Azure public outbound ranges if possible, otherwise keep the default (public) and rely on key secrecy.

## Provisioning Checklist

1. Log in to https://app.supabase.com and create the project.
2. Navigate to **Project Settings → API** and regenerate the anon + service role keys.
3. Navigate to **Project Settings → Database** and rotate the database password, noting both the pooled and transaction connection strings.
4. Export metrics/backups configuration to confirm point-in-time recovery (PITR) aligns with compliance requirements.
5. Store every regenerated secret inside Azure Key Vault (see Task 1.2).
6. Update the Azure `infra/parameters/<env>.json` files with placeholders referencing your newly created secrets and set runtime values via `azd env set SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_CONNECTION` before deploying.
7. Run `scripts/seed_supabase_user.py` (once Task 2.2 is completed) against the managed URL to recreate the admin account.

## Operational Notes

- **Do not** leave Supabase credentials in shell history. Use `az keyvault secret set` or Azure DevOps variable groups.
- When rotating keys, update Key Vault first, redeploy infrastructure (`azd deploy`), and only then update local `.env` files so developers remain in sync.
- Kong inside Azure does not proxy managed Supabase; applications should talk directly to the managed endpoint via the secrets described above.

## Azure VM Supabase Stack Runbook

The Azure VM (`supabaseadmin@<vm-ip>`) still hosts the self-contained Supabase stack for disaster recovery and heavy integration testing. The stack is defined by `docker-compose.yml` plus the trimmed `docker-compose.supabase.yml` and now includes:

- Postgres (`supabase-db`)
- GoTrue (`supabase-auth`)
- PostgREST (`supabase-rest`)
- Storage API + ImgProxy (`supabase-storage`, `supabase-imgproxy`)
- Realtime (`supabase-realtime`)
- Meta & Studio (`supabase-meta`, `supabase-studio`)
- Kong gateway (`supabase-kong`)
- Inbucket mail sink (`supabase-inbucket`) for password reset test flows

### 1. Updating Compose + Secrets

```bash
# From your laptop
scp docker-compose.yml supabaseadmin@${VM_IP}:/home/supabaseadmin/local-ai/
scp docker-compose.supabase.yml supabaseadmin@${VM_IP}:/home/supabaseadmin/local-ai/
scp .env supabaseadmin@${VM_IP}:/home/supabaseadmin/local-ai/
```

- Ensure `.env` contains the rotated `POSTGRES_PASSWORD`, anon key, service role key, and JWT secret.
- Keep the `/home/supabaseadmin/local-ai` copy authoritative; all services read from that file when restarted.

### 2. Starting or Refreshing Services

```bash
ssh supabaseadmin@${VM_IP}
cd ~/local-ai
docker compose --profile supabase up -d supabase-db supabase-auth supabase-rest supabase-storage \
	supabase-imgproxy supabase-realtime supabase-meta supabase-studio supabase-kong supabase-inbucket
```

- The shared `local-ai` network is created automatically; verify with `docker network inspect local-ai` if you see DNS errors.
- If `docker compose ps supabase-kong` reports `Created`, wait for `supabase-auth`, `supabase-rest`, and `supabase-storage` to finish warming up, then run `docker compose --profile supabase up -d supabase-kong` to attach the gateway once dependencies are healthy.
- When rotating passwords, restart `supabase-auth`, `supabase-rest`, `supabase-storage`, and `supabase-realtime` after the database roles are updated.

### 3. Health Verification

```bash
docker compose ps
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/auth/v1/health      # GoTrue via Kong
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/rest/v1/?select=1    # PostgREST via Kong
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9000                      # Inbucket UI
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8005                      # Studio through Caddy (if enabled)
```

- All commands above should return `200`. A `503` usually indicates Kong cannot resolve a backend service; confirm the container is attached to `local-ai` and restart it.
- For realtime, run `docker compose logs --tail 20 supabase-realtime` and confirm migrations finish without errors before allowing clients to connect.

### 4. Troubleshooting Tips

- **DNS errors inside Kong**: `docker network connect local-ai supabase-kong` (then restart) fixes missing network attachments.
- **Storage uploads fail**: ensure `supabase-storage` and `supabase-imgproxy` share the `/supabase/docker/volumes/storage` bind mount and that the disk is still mounted under `/srv/supabase/volumes`.
- **Auth email tests fail**: check `docker compose logs supabase-inbucket` and open `http://<vm-ip>:9000` in a browser to view captured messages.
- **Studio cannot authenticate**: verify `SUPABASE_URL=http://supabase-kong:8000` and the anon key in `.env` match the running stack.

Document any production-impacting changes (password rotations, disk swaps, service restarts) in `Copilot-Processing.md` or your SOC logs so the next operator understands the VM state.

## Admin Seeding Runbook

- Retrieve the managed Supabase URL + service role key from Key Vault (example commands live in `documentation/setup.md`).
- Run `python scripts/seed_supabase_user.py --email <admin> --password <password> --supabase-url "$SUPABASE_URL" --service-role-key "$SERVICE_ROLE_KEY"`.
- Confirm the account appears in Supabase Studio → Authentication → Users before handing credentials to operators.

## Password Alignment Runbook

Use these steps whenever you rotate the primary database password (currently `R7m2yPkq9Dz41Tx8VbLc` in `.env`).

1. **Update repo secrets**
	- Edit `.env` (and any developer-specific overrides) so `POSTGRES_PASSWORD` matches the newly selected value.
	- Commit the change if the repository intentionally tracks the shared sample; otherwise, store it in your secret manager only.
2. **Push to Azure Key Vault**
	```bash
	az keyvault secret set \
	  --vault-name <kv-name> \
	  --name supabase-db-password \
	  --value "$POSTGRES_PASSWORD"
	```
	- Repeat for other Supabase secrets if they were rotated alongside the database password.
3. **Sync the Azure VM docker stack**
	```bash
	export POSTGRES_PASSWORD=R7m2yPkq9Dz41Tx8VbLc
	ssh supabaseadmin@<vm-ip>
	sudo docker exec supabase-db psql -U postgres -c "ALTER ROLE postgres PASSWORD '$POSTGRES_PASSWORD';"
	sudo docker exec supabase-db psql -U postgres -c "ALTER ROLE authenticator PASSWORD '$POSTGRES_PASSWORD';"
	sudo docker exec supabase-db psql -U postgres -c "ALTER ROLE supabase_auth_admin PASSWORD '$POSTGRES_PASSWORD';"
	sudo docker compose --profile supabase up -d supabase-auth supabase-rest
	```
	- Restart other Supabase containers if they depend on the password (storage, realtime, etc.).
4. **Validate**
	- `docker ps` should show `supabase-auth` and `supabase-rest` in a healthy state.
	- Run `docker logs supabase-auth | tail` to confirm the new credentials allow GoTrue to connect.
	- Run `docker logs supabase-rest | tail` to ensure PostgREST authentication succeeds.

Document the rotation (time, operator, reason) in your internal runbook so auditors can trace when the password changed.

## Next Steps

- Follow Task 1.2 to make Bicep ingest the managed Supabase secrets automatically.
- Follow Task 2.1 to wire the Static Web App and Container App to those secrets.
- Follow Task 2.2 to seed admin users and confirm authentication flows end-to-end.
