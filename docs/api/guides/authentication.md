# Authentication

FetchText API supports two authentication methods depending on your use case.

## Authentication Methods

| Method | Use Case | Header Format |
|--------|----------|---------------|
| **API Key** | Third-party integrations, external apps | `Authorization: Bearer ftxt_xxx` |
| **JWT Token** | Dashboard users, admin operations | `Authorization: Bearer <jwt>` |

---

## API Key Authentication

API keys are the primary authentication method for third-party integrations.

### Key Format

```
ftxt_<43 random characters>
```

Example: `ftxt_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0uvw`

### Using API Keys

Include your API key in the `Authorization` header:

```bash
curl https://api.fetchtext.io/api/v1/process \
  -H "Authorization: Bearer ftxt_your_api_key" \
  -F "file=@document.pdf"
```

### Creating API Keys

#### Via Dashboard

1. Log into FetchText dashboard
2. Navigate to **Settings** → **API Keys**
3. Click **Create New Key**
4. Configure options:
   - **Name**: Descriptive name for the key
   - **Expiration**: 1-3650 days (default: 365)
   - **Rate Limits**: Requests per minute
   - **Permissions**: upload, process, templates_read
5. Click **Create**
6. **Copy the key immediately** - it's shown only once!

#### Via API

```bash
curl -X POST https://api.fetchtext.io/api/admin/keys/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Integration",
    "organization_id": "org_abc123",
    "description": "Main production API key",
    "expires_in_days": 365,
    "rate_limit_per_minute": 60,
    "upload_limit_per_minute": 10,
    "permissions": {
      "upload": true,
      "process": true,
      "templates_read": true
    }
  }'
```

Response:

```json
{
  "id": "key_xyz789",
  "name": "Production Integration",
  "api_key": "ftxt_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0uvw",
  "key_prefix": "ftxt_a1b2c3d4",
  "organization_id": "org_abc123",
  "is_active": true,
  "rate_limit_per_minute": 60,
  "upload_limit_per_minute": 10,
  "permissions": {
    "upload": true,
    "process": true,
    "templates_read": true
  },
  "created_at": "2025-02-04T12:00:00Z",
  "expires_at": "2026-02-04T12:00:00Z",
  "warning": "Store this API key securely. It will not be shown again."
}
```

### Managing API Keys

#### List Keys

```bash
curl https://api.fetchtext.io/api/admin/keys/list/org_abc123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Key Details

```bash
curl https://api.fetchtext.io/api/admin/keys/key_xyz789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Revoke a Key

```bash
curl -X DELETE https://api.fetchtext.io/api/admin/keys/key_xyz789/revoke \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## JWT Authentication

JWT tokens are used for dashboard operations and admin endpoints.

### Obtaining JWT Tokens

JWT tokens are automatically issued when users log into the FetchText dashboard via Supabase authentication.

### Token Contents

```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "aud": "authenticated",
  "exp": 1707048000
}
```

### Using JWT Tokens

```bash
curl https://api.fetchtext.io/api/admin/keys/list/org_abc123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Permissions

### API Key Permissions

| Permission | Description | Endpoints Allowed |
|------------|-------------|-------------------|
| `upload` | Upload documents for processing | `POST /api/v1/process` |
| `process` | Check job status and results | `GET /api/v1/jobs/{job_id}` |
| `templates_read` | List available templates | `GET /api/v1/templates` |

### Default Permissions

New API keys are created with all permissions enabled by default.

---

## Rate Limits

### Default Limits

| Limit Type | Default | Maximum |
|------------|---------|---------|
| General requests | 60/minute | 1000/minute |
| Upload operations | 10/minute | 100/minute |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1707048060
```

### Rate Limit Exceeded (429)

```json
{
  "detail": "Rate limit exceeded. Retry after 45 seconds."
}
```

Headers:
```
Retry-After: 45
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707048060
```

---

## Security Best Practices

### Do

- Store API keys in environment variables or secret managers
- Use different keys for development and production
- Set appropriate expiration dates
- Monitor key usage regularly
- Rotate keys periodically

### Don't

- Commit API keys to version control
- Share keys via unencrypted channels
- Use the same key across multiple applications
- Ignore expiration warnings

### Environment Variables

```bash
# .env file (never commit this!)
FETCHTEXT_API_KEY=ftxt_your_api_key_here
```

```python
import os
api_key = os.environ.get('FETCHTEXT_API_KEY')
```

```javascript
const apiKey = process.env.FETCHTEXT_API_KEY;
```

---

## Error Responses

### 401 Unauthorized

Missing or invalid authentication:

```json
{
  "detail": "Missing or invalid API key"
}
```

### 403 Forbidden

Valid key but insufficient permissions:

```json
{
  "detail": "API key does not have 'upload' permission"
}
```

### Expired Key

```json
{
  "detail": "API key has expired"
}
```

---

## Testing Authentication

### Health Check (No Auth Required)

```bash
curl https://api.fetchtext.io/api/v1/health
```

### Authenticated Request

```bash
curl https://api.fetchtext.io/api/v1/templates \
  -H "Authorization: Bearer ftxt_your_api_key"
```

If successful, you'll receive a `200 OK` with template data.
