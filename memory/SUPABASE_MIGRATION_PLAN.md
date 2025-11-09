# Supabase Database Migration Plan

## Overview
Migration from `postgres:15` to `supabase/postgres:15.6.1.117` to enable proper realtime WebSocket functionality.

## Current State Analysis

### Database Contents
- **User Data**: 4 users in auth.users
- **Application Data**: 1 document, 9 smart templates
- **Schemas**: public, auth, storage, _realtime, realtime
- **System Tables**: 28 Supabase system tables across auth, storage, _realtime schemas

### Key Data Inventory
- **auth.users**: 4 user accounts with authentication data
- **public.documents**: 1 document with user ownership
- **public.smart_templates**: 9 templates with ownership and public/private settings
- **public.template_categories**: Template categorization
- **public.template_embeddings**: Vector embeddings for templates
- **public.workflow_templates**: N8N workflow configurations
- **public.workflow_instances**: Workflow execution instances
- **public.workflow_executions**: Workflow execution logs
- **storage.buckets & storage.objects**: File storage metadata

### RLS Security Configuration
- **26 Row Level Security policies** across 8 tables
- User-based ownership controls (created_by = auth.uid())
- Public/private visibility controls
- Complex cross-table permission checks for embeddings

## Migration Strategy

### Phase 1: Complete Backup Creation
```bash
# 1. Create full database dump including all schemas, data, and permissions
docker exec supabase-db pg_dump -U postgres -d postgres \
  --clean --create --if-exists \
  --format=custom \
  --compress=9 \
  --verbose > /backup/supabase_full_backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Create separate schema-specific backups for safety
docker exec supabase-db pg_dump -U postgres -d postgres \
  --schema=auth --format=custom > /backup/auth_schema_backup.dump
docker exec supabase-db pg_dump -U postgres -d postgres \
  --schema=storage --format=custom > /backup/storage_schema_backup.dump
docker exec supabase-db pg_dump -U postgres -d postgres \
  --schema=public --format=custom > /backup/public_schema_backup.dump

# 3. Export RLS policies as SQL
docker exec supabase-db psql -U postgres -d postgres \
  -c "SELECT 'CREATE POLICY ' || quote_ident(policyname) || ' ON ' || 
      quote_ident(schemaname) || '.' || quote_ident(tablename) || 
      ' FOR ' || cmd || ' TO ' || array_to_string(roles, ', ') ||
      CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END || ';'
      FROM pg_policies ORDER BY schemaname, tablename;" \
  -t -A > /backup/rls_policies_backup.sql
```

### Phase 2: Environment Preparation
```bash
# 1. Create backup directory with proper permissions
mkdir -p ./backups/supabase_migration
chmod 755 ./backups/supabase_migration

# 2. Stop dependent services (preserve data volumes)
docker stop supabase-rest supabase-auth supabase-storage realtime-dev.supabase-realtime supabase-kong

# 3. Create new data volume for supabase/postgres
docker volume create supabase_postgres_data_new
```

### Phase 3: New Database Container Setup
```bash
# 1. Start new supabase/postgres container
docker run -d \
  --name supabase-db-new \
  --network localai_default \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=Awaah3c7cxR1ZPaA1V9L \
  -e POSTGRES_DB=postgres \
  -v supabase_postgres_data_new:/var/lib/postgresql/data \
  -v ./backups/supabase_migration:/backup \
  supabase/postgres:15.6.1.117

# 2. Wait for database to be ready
docker exec supabase-db-new bash -c 'until pg_isready -U postgres; do sleep 1; done'

# 3. Verify required extensions are available
docker exec supabase-db-new psql -U postgres -c "SELECT name FROM pg_available_extensions WHERE name IN ('wal2json', 'uuid-ossp', 'pg_stat_statements');"
```

### Phase 4: Data Migration
```bash
# 1. Restore full database dump
docker exec supabase-db-new pg_restore -U postgres -d postgres \
  --clean --if-exists --verbose \
  /backup/supabase_full_backup_YYYYMMDD_HHMMSS.dump

# 2. Verify data integrity
docker exec supabase-db-new psql -U postgres -d postgres -c "
  SELECT 'auth.users' as table_name, count(*) as count FROM auth.users
  UNION ALL
  SELECT 'public.documents', count(*) FROM public.documents
  UNION ALL 
  SELECT 'public.smart_templates', count(*) FROM public.smart_templates
  UNION ALL
  SELECT 'storage.objects', count(*) FROM storage.objects;"

# 3. Verify RLS policies are intact
docker exec supabase-db-new psql -U postgres -d postgres -c "SELECT count(*) as policy_count FROM pg_policies;"

# 4. Configure PostgreSQL for realtime
docker exec supabase-db-new psql -U postgres -c "
  ALTER SYSTEM SET wal_level = logical;
  ALTER SYSTEM SET max_wal_senders = 10;
  ALTER SYSTEM SET max_replication_slots = 10;
  SELECT pg_reload_conf();"
```

### Phase 5: Service Reconfiguration
```bash
# 1. Remove old database container (ONLY after verification)
docker stop supabase-db
docker rename supabase-db supabase-db-old-backup

# 2. Rename new container to match expected hostname
docker stop supabase-db-new
docker rename supabase-db-new supabase-db

# 3. Start database with new image
docker start supabase-db

# 4. Verify realtime extensions
docker exec supabase-db psql -U postgres -c "SELECT * FROM pg_extension WHERE extname = 'wal2json';"
```

### Phase 6: Service Restart & Verification
```bash
# 1. Start Supabase services in dependency order
docker start supabase-auth
sleep 5
docker start supabase-rest  
sleep 5
docker start supabase-storage
sleep 5
docker start realtime-dev.supabase-realtime
sleep 5
docker start supabase-kong

# 2. Verify all services are healthy
docker ps | grep supabase

# 3. Test realtime connectivity
curl -v "ws://localhost:8000/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU"

# 4. Test application functionality
# - User authentication
# - Document access
# - Template operations
# - Realtime subscriptions
```

## Rollback Plan

### Immediate Rollback (if migration fails)
```bash
# 1. Stop all services
docker stop supabase-auth supabase-rest supabase-storage realtime-dev.supabase-realtime supabase-kong supabase-db

# 2. Restore original container
docker rename supabase-db supabase-db-failed
docker rename supabase-db-old-backup supabase-db

# 3. Start original database
docker start supabase-db

# 4. Restart services
docker start supabase-auth supabase-rest supabase-storage realtime-dev.supabase-realtime supabase-kong
```

### Data Recovery (if data corruption occurs)
```bash
# 1. Create fresh supabase/postgres container
docker run -d --name supabase-db-recovery \
  --network localai_default \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=Awaah3c7cxR1ZPaA1V9L \
  -e POSTGRES_DB=postgres \
  -v supabase_postgres_data_recovery:/var/lib/postgresql/data \
  supabase/postgres:15.6.1.117

# 2. Restore from backup
docker exec supabase-db-recovery pg_restore -U postgres -d postgres \
  /backup/supabase_full_backup_YYYYMMDD_HHMMSS.dump
```

## Pre-Migration Checklist
- [ ] Application is in maintenance mode
- [ ] Users are notified of downtime
- [ ] All backups are created and verified
- [ ] Backup restoration has been tested
- [ ] Required disk space is available
- [ ] Team is available for rollback if needed

## Post-Migration Verification
- [ ] Database schema matches original
- [ ] All user data is present and accessible
- [ ] RLS policies are functioning correctly
- [ ] Authentication works properly
- [ ] File storage operations work
- [ ] Realtime WebSocket connections succeed
- [ ] Application functionality is fully restored
- [ ] Performance is acceptable

## Risk Assessment
- **Low Risk**: Schema and basic data migration (standard pg_dump/restore)
- **Medium Risk**: RLS policy preservation (included in dump)
- **High Risk**: Service connectivity during transition (mitigated by rollback plan)
- **Critical Risk**: Data loss (mitigated by multiple backup layers)

## Estimated Downtime
- **Preparation**: 15 minutes
- **Migration**: 10 minutes  
- **Verification**: 15 minutes
- **Total**: ~40 minutes maximum

## Success Criteria
1. All original data is present and accessible
2. User authentication functions correctly
3. All RLS policies are preserved and working
4. Realtime WebSocket connections work without errors
5. Application performance is maintained or improved