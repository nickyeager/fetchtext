# Supabase Managed Migration Instructions

## Current Status ✅

- **Dashboard**: Deployed with new Supabase credentials
- **Container App**: Updated and restarted with new credentials
- **Database Backup**: Created at `/tmp/supabase_backup.sql` on Azure VM
- **Migration Script**: Ready at `SUPABASE_MIGRATION.sql` (1,495 lines)

## Migration Options

### Option 1: Run Migration Script (Recommended - Fastest)

This creates a fresh database schema with seeded templates. Use this if you want to start with a clean slate and pre-populated templates.

**Steps:**

1. **Open Supabase SQL Editor**
   ```
   https://app.supabase.com/project/your-project-id/sql/new
   ```

2. **Copy the migration script**
   - Open `SUPABASE_MIGRATION.sql` in this directory
   - Copy the entire file contents (Cmd+A, Cmd+C)

3. **Paste and Run**
   - Paste into the SQL Editor
   - Click "Run" button
   - Wait for completion (~30 seconds)

4. **Verify Success**
   - Check for "Success. No rows returned" message
   - Navigate to Table Editor to see created tables:
     - smart_templates
     - templates
     - workflow_templates
     - documents
     - template_categories
     - template_embeddings

5. **Create Storage Bucket (IMPORTANT)**
   - Navigate to Storage section in Supabase Dashboard
   - Click "Create a new bucket"
   - Bucket name: `documents`
   - Public bucket: **OFF** (keep private)
   - File size limit: `52428800` (50MB)
   - Allowed MIME types: Leave empty or add:
     - application/pdf
     - image/png, image/jpeg, image/jpg
     - text/plain
     - application/msword
     - application/vnd.openxmlformats-officedocument.wordprocessingml.document
   - Click "Create bucket"

6. **Create Admin User**
   ```sql
   -- Run this in SQL Editor after migration
   INSERT INTO auth.users (
     id,
     instance_id,
     email,
     encrypted_password,
     email_confirmed_at,
     created_at,
     updated_at,
     raw_app_meta_data,
     raw_user_meta_data,
     is_super_admin,
     role
   ) VALUES (
     gen_random_uuid(),
     '00000000-0000-0000-0000-000000000000',
     'admin@fetchtext.local',
     crypt('***REMOVED-TEST-PASSWORD***', gen_salt('bf')),
     NOW(),
     NOW(),
     NOW(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Admin User"}',
     false,
     'authenticated'
   );
   ```

### Option 2: Restore Database Backup (When DNS Propagates)

This restores your existing data including any documents and custom templates you've created.

**Wait for DNS propagation** (check with `nslookup db.your-project.supabase.co`)

Once DNS resolves, run from Azure VM:

```bash
# From Azure VM (128.24.73.54)
PGPASSWORD='LeastClothSky23!' psql \
  -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -f /tmp/supabase_backup.sql
```

**Note**: DNS propagation can take 10-30 minutes. The database endpoint is `db.your-project.supabase.co`.

## What the Migration Creates

### Tables
- **smart_templates**: AI-powered templates (12 seeded templates)
- **templates**: Standard field-based templates
- **workflow_templates**: N8N workflow templates
- **documents**: User uploaded documents
- **template_categories**: Template organization (11 categories)
- **template_embeddings**: Vector embeddings for template matching
- **workflow_instances**: Workflow execution instances
- **workflow_executions**: Workflow execution history

### Seeded Templates
The migration includes 12 production-ready smart templates:
1. Business Card Extractor
2. Invoice Parser
3. Resume/CV Analyzer
4. Contract Analyzer
5. Receipt Parser
6. Medical Records Extractor
7. Tax Document Processor
8. Identity Document Processor
9. Financial Statement Analyzer
10. Legal Document Analyzer
11. Real Estate Document Processor
12. Academic Transcript Parser

### Row Level Security (RLS)
All tables have comprehensive RLS policies:
- **Public templates**: Anyone can view
- **Private templates**: Only creator can view/edit
- **Documents**: User-owned, fully private
- **Template embeddings**: Inherit template permissions

## Post-Migration Tasks

After running the migration script:

1. **Test Login**
   ```
   Navigate to: https://fetchtext.io
   Login: admin@fetchtext.local / ***REMOVED-TEST-PASSWORD***
   ```

2. **Verify Templates**
   - Check that all 12 smart templates appear in the gallery
   - Verify template categories are populated

3. **Test Document Upload**
   - Upload a test document (PDF or image)
   - Verify template matching works
   - Check extraction functionality

4. **Stop VM Supabase** (after verification)
   ```bash
   # SSH to Azure VM
   cd /home/supabaseadmin/local-ai
   docker compose stop supabase-db supabase-rest supabase-kong supabase-storage
   ```

5. **Update DNS** (optional - can remove api.fetchtext.io)
   ```
   Since we're using managed Supabase, api.fetchtext.io is no longer needed.
   You can remove this DNS record or leave it for N8N/Ollama access.
   ```

## Architecture After Migration

### Azure VM (128.24.73.54)
- **N8N**: Workflow automation at https://n8n.fetchtext.io
- **Ollama**: Local LLMs (optional, can be stopped to save resources)
- **Supabase containers**: STOPPED (no longer needed)

### Managed Supabase
- **Database**: PostgreSQL with all tables and RLS
- **Auth**: User authentication and JWT tokens
- **Storage**: Document uploads (using S3 backend)
- **API**: REST and GraphQL endpoints

### Azure Container Apps
- **Document Processor**: FastAPI backend with new Supabase credentials

### Azure Static Web Apps
- **Dashboard**: React frontend with new Supabase credentials

## Estimated Costs After Migration

- **Managed Supabase Free Tier**: $0/month (500MB database, 1GB storage)
- **Azure VM B2s**: ~$35/month (N8N + Ollama only)
- **Azure Container Apps**: ~$20/month (document processor)
- **Azure Static Web Apps**: Free tier

**Total Savings**: ~$35/month by removing self-hosted Supabase from VM

## Troubleshooting

### Migration Script Fails
- Check that you're logged into the correct Supabase project
- Ensure you're running in SQL Editor, not Terminal
- Check for syntax errors in the console

### DNS Not Resolving
- Normal for new projects, wait 10-30 minutes
- Use migration script (Option 1) instead of backup restore
- Supabase API works immediately even if database endpoint doesn't resolve

### Login Fails After Migration
- Verify admin user was created in auth.users table
- Check browser console for errors
- Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct in GitHub secrets
- Clear browser cache and try again

### Templates Not Appearing
- Run this query to verify templates exist:
  ```sql
  SELECT COUNT(*) FROM smart_templates;
  ```
- Should return 12 if migration was successful
- Check is_public = true for templates to appear in gallery

## Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **SQL Editor**: https://app.supabase.com/project/your-project-id/sql
- **Table Editor**: https://app.supabase.com/project/your-project-id/editor
- **Logs**: https://app.supabase.com/project/your-project-id/logs/explorer
