# Supabase Deployment Log

This document tracks all changes made to the managed Supabase instance for production.

**Managed Instance:** https://rawhmcrtzfdhryyfovee.supabase.co
**Environment:** Production
**Tracking Started:** 2025-12-14

---

## Deployment Entry Template

```
### YYYY-MM-DD HH:MM UTC - [Deployment Description]

**Deployed By:** [Your Name/GitHub Username]
**Migration Files Applied:**
- `supabase/migrations/XXX_description.sql`

**Changes:**
- [List of schema changes]
- [New tables, columns, indexes, policies]

**Verification:**
- [ ] Schema changes verified in Supabase Studio
- [ ] RLS policies tested with authenticated user
- [ ] Frontend integration tested
- [ ] Backend integration tested

**Rollback Plan:**
- [How to rollback if needed]

**Notes:**
- [Any additional context or issues encountered]
```

---

## Deployment History

### 2025-12-14 Initial Schema Deployment

**Deployed By:** Nick Yeager
**Migration Files Applied:**
- `SUPABASE_MIGRATION.sql` (combined migrations 001-012)

**Changes:**
- Created initial schema: smart_templates, documents, template_categories
- Created workflow tables: workflow_instances, workflow_executions
- Created template_embeddings for vector search
- Seeded 8 default smart templates (Business Card, Invoice, Resume, etc.)
- Enabled RLS on all user data tables
- Created storage bucket: `documents`

**Verification:**
- [x] Schema verified in SQL Editor
- [ ] RLS policies tested
- [ ] Frontend tested with document upload
- [ ] Backend tested with document processing

**Rollback Plan:**
- Drop all tables: `DROP TABLE IF EXISTS documents, smart_templates, templates, workflow_templates, workflow_instances, workflow_executions, template_embeddings, template_categories CASCADE;`
- Requires backup before next deployment

**Notes:**
- Storage bucket created manually (not via SQL)
- Extensions (uuid-ossp, pgcrypto, vector) pre-installed by Supabase
- Schema validation script created: `validate-supabase-schema.sql`
