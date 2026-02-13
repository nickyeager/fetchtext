# Error Handling

This guide covers all error responses from the FetchText API and how to handle them.

## Error Response Format

All errors return a JSON response with a `detail` field:

```json
{
  "detail": "Error message describing what went wrong"
}
```

---

## HTTP Status Codes

### 200 OK

Request succeeded. Response body contains the requested data.

### 202 Accepted

Request accepted for asynchronous processing. Response contains a `job_id` for tracking:

```json
{
  "job_id": "abc123-def456",
  "status": "pending",
  "message": "Document processing started"
}
```

### 400 Bad Request

Invalid input or request format.

**Common causes:**
- Missing required parameters
- Invalid file format
- Malformed JSON
- Invalid parameter values

**Examples:**

```json
{
  "detail": "No file provided"
}
```

```json
{
  "detail": "Unsupported file type: .xyz. Supported types: .pdf, .docx, .pptx, .html, .md, .txt"
}
```

```json
{
  "detail": "confidence_threshold must be between 0.0 and 1.0"
}
```

**How to fix:**
- Check required parameters in the API reference
- Verify file format is supported
- Validate parameter values before sending

### 401 Unauthorized

Authentication required or invalid credentials.

**Common causes:**
- Missing `Authorization` header
- Invalid API key
- Expired API key
- Malformed token

**Examples:**

```json
{
  "detail": "Missing or invalid API key"
}
```

```json
{
  "detail": "API key has expired"
}
```

```json
{
  "detail": "Invalid authorization header format. Expected: Bearer <token>"
}
```

**How to fix:**
- Include `Authorization: Bearer <your_key>` header
- Verify API key is correct and active
- Check key hasn't expired
- Generate a new key if necessary

### 403 Forbidden

Valid authentication but insufficient permissions.

**Common causes:**
- API key lacks required permission
- Access denied to organization resource
- Operation not allowed for your account

**Examples:**

```json
{
  "detail": "API key does not have 'upload' permission"
}
```

```json
{
  "detail": "Access denied to this organization"
}
```

**How to fix:**
- Check API key permissions in dashboard
- Create a new key with required permissions
- Verify organization membership

### 404 Not Found

Requested resource doesn't exist.

**Common causes:**
- Invalid job ID
- Template not found
- Resource was deleted

**Examples:**

```json
{
  "detail": "Job not found"
}
```

```json
{
  "detail": "Template tpl_xxx not found"
}
```

**How to fix:**
- Verify the resource ID is correct
- Check if resource was deleted
- Ensure you have access to the resource

### 429 Too Many Requests

Rate limit exceeded.

**Headers included:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707048060
Retry-After: 45
```

**Example:**

```json
{
  "detail": "Rate limit exceeded. Retry after 45 seconds."
}
```

**How to fix:**
- Wait for the time specified in `Retry-After`
- Implement exponential backoff
- Consider requesting higher rate limits
- Batch requests where possible

### 500 Internal Server Error

Server-side error during processing.

**Example:**

```json
{
  "detail": "Internal server error. Please try again later."
}
```

**How to fix:**
- Retry the request after a short delay
- If persistent, contact support with request details
- Check the FetchText status page

### 503 Service Unavailable

Service temporarily unavailable.

**Common causes:**
- Database unavailable
- Dependent service down
- Maintenance in progress

**Example:**

```json
{
  "detail": "Service temporarily unavailable. Please try again later."
}
```

**How to fix:**
- Wait and retry
- Check the status page
- Contact support if prolonged

---

## Error Handling Examples

### Python

```python
import requests
from requests.exceptions import RequestException
import time

def process_document(file_path, api_key, max_retries=3):
    """Process a document with error handling and retries."""
    url = "https://api.fetchtext.io/api/v1/process"
    headers = {"Authorization": f"Bearer {api_key}"}

    for attempt in range(max_retries):
        try:
            with open(file_path, 'rb') as f:
                response = requests.post(
                    url,
                    headers=headers,
                    files={"file": f},
                    data={"auto_generate_template": "true"}
                )

            # Handle different status codes
            if response.status_code == 202:
                return response.json()  # Success

            elif response.status_code == 400:
                error = response.json()
                raise ValueError(f"Bad request: {error['detail']}")

            elif response.status_code == 401:
                raise PermissionError("Invalid or expired API key")

            elif response.status_code == 403:
                error = response.json()
                raise PermissionError(f"Access denied: {error['detail']}")

            elif response.status_code == 429:
                # Rate limited - wait and retry
                retry_after = int(response.headers.get('Retry-After', 60))
                print(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                continue

            elif response.status_code >= 500:
                # Server error - retry with backoff
                wait_time = 2 ** attempt
                print(f"Server error. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue

            else:
                response.raise_for_status()

        except RequestException as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"Request failed: {e}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                raise

    raise Exception("Max retries exceeded")


# Usage
try:
    result = process_document("invoice.pdf", "ftxt_your_api_key")
    print(f"Job ID: {result['job_id']}")
except ValueError as e:
    print(f"Invalid request: {e}")
except PermissionError as e:
    print(f"Auth error: {e}")
except Exception as e:
    print(f"Failed: {e}")
```

### JavaScript

```javascript
class FetchTextError extends Error {
  constructor(message, statusCode, detail) {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

async function processDocument(filePath, apiKey, maxRetries = 3) {
  const url = 'https://api.fetchtext.io/api/v1/process';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('auto_generate_template', 'true');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: form
      });

      // Handle different status codes
      if (response.status === 202) {
        return await response.json();  // Success
      }

      const errorData = await response.json().catch(() => ({}));

      if (response.status === 400) {
        throw new FetchTextError(
          'Bad request',
          400,
          errorData.detail || 'Invalid request'
        );
      }

      if (response.status === 401) {
        throw new FetchTextError(
          'Unauthorized',
          401,
          'Invalid or expired API key'
        );
      }

      if (response.status === 403) {
        throw new FetchTextError(
          'Forbidden',
          403,
          errorData.detail || 'Access denied'
        );
      }

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (response.status >= 500) {
        // Server error - retry with backoff
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Server error. Retrying in ${waitTime/1000} seconds...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      throw new FetchTextError(
        'Unknown error',
        response.status,
        errorData.detail
      );

    } catch (error) {
      if (error instanceof FetchTextError) {
        throw error;  // Don't retry client errors
      }

      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Request failed. Retrying in ${waitTime/1000} seconds...`);
        await new Promise(r => setTimeout(r, waitTime));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
try {
  const result = await processDocument('invoice.pdf', 'ftxt_your_api_key');
  console.log(`Job ID: ${result.job_id}`);
} catch (error) {
  if (error instanceof FetchTextError) {
    console.error(`API Error ${error.statusCode}: ${error.detail}`);
  } else {
    console.error(`Failed: ${error.message}`);
  }
}
```

---

## Retry Strategy

### Recommended Backoff

| Attempt | Wait Time | Cumulative |
|---------|-----------|------------|
| 1 | 0s | 0s |
| 2 | 1s | 1s |
| 3 | 2s | 3s |
| 4 | 4s | 7s |
| 5 | 8s | 15s |

### When to Retry

| Status Code | Retry? | Notes |
|-------------|--------|-------|
| 429 | Yes | Wait for `Retry-After` |
| 500 | Yes | Exponential backoff |
| 502 | Yes | Exponential backoff |
| 503 | Yes | Exponential backoff |
| 504 | Yes | Exponential backoff |
| 400 | No | Fix the request |
| 401 | No | Fix authentication |
| 403 | No | Fix permissions |
| 404 | No | Resource doesn't exist |

---

## Common Issues

### "No file provided"

```json
{"detail": "No file provided"}
```

**Solution:** Ensure you're sending the file as multipart form data:

```bash
# Correct
curl -F "file=@document.pdf" ...

# Wrong
curl -d '{"file": "..."}' ...
```

### "Unsupported file type"

```json
{"detail": "Unsupported file type: .xyz"}
```

**Solution:** Use a supported format: PDF, DOCX, PPTX, HTML, MD, TXT, or images (PNG, JPG, etc.)

### "API key does not have 'upload' permission"

```json
{"detail": "API key does not have 'upload' permission"}
```

**Solution:** Create a new API key with the required permissions in the dashboard.

### "Rate limit exceeded"

```json
{"detail": "Rate limit exceeded. Retry after 45 seconds."}
```

**Solution:**
1. Wait for the specified time
2. Implement rate limiting in your client
3. Request higher limits if needed

---

## Getting Help

If you encounter persistent errors:

1. Check the [status page](https://status.fetchtext.io)
2. Search the [documentation](https://docs.fetchtext.io)
3. Contact [support@fetchtext.io](mailto:support@fetchtext.io) with:
   - Request ID (if available)
   - Timestamp
   - Full error message
   - Request details (without sensitive data)
