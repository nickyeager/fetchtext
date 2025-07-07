# Supabase Integration

## Overview
This admin dashboard uses the **existing Supabase infrastructure** from the parent directory (`../docker-compose.yml`).

## Configuration

### Environment Variables
Supabase connection is configured in `.env.local`:
```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey AgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
```

### Architecture
```
Frontend (Admin Dashboard)
    ↓
http://localhost:8000 (Kong Gateway)
    ↓
Supabase Services (Parent Docker Setup)
    ├── supabase-db (PostgreSQL)
    ├── supabase-auth (GoTrue)
    ├── supabase-edge-functions (Deno)
    └── supabase-storage (File Storage)
```

## Email Service

### SendGrid Integration
Email functionality uses **Supabase Edge Functions** with SendGrid:

- **Function Location**: `../supabase/docker/volumes/functions/send-email/`
- **Endpoint**: `http://localhost:8000/functions/v1/send-email`
- **Configuration**: SendGrid API key stored in `../supabase/docker/.env`

### Usage
```typescript
import { sendPasswordResetEmail } from '@/lib/email-client';

const result = await sendPasswordResetEmail(
  'user@example.com',
  'https://app.com/reset?token=abc123'
);
```

## Development

### Starting Services
The Supabase services are started automatically with the parent Docker setup:
```bash
# From parent directory
docker-compose up
```

### Testing Edge Functions
```bash
curl -X POST http://localhost:8000/functions/v1/send-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<h1>Test</h1>"}'
```

## Important Notes

- **DO NOT** create a separate Supabase project for this dashboard
- **DO NOT** deploy Edge Functions separately - they're part of the parent setup
- **DO NOT** modify Supabase configuration directly - use the parent Docker setup
- Email functions are automatically available once parent services are running 