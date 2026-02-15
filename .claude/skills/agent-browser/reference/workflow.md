# Core Workflow: End-to-End Validation

Reference guide for full application validation using agent-browser.

---

## Application URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `http://localhost:5173` | React dashboard |
| Backend | `http://localhost:8090` | Document Processor API |
| Health Check | `http://localhost:8090/health` | Server status |
| Supabase | `http://localhost:8000` | Kong gateway |

---

## Pre-Flight Checks

Before testing, ensure services are running:

```bash
# Check backend health
agent-browser open http://localhost:8090/health
agent-browser get text body
# Expected: {"status":"ok"}

# Open frontend
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
```

---

## Core Feature Validation

### 1. Login Flow

```bash
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser snapshot -i
# Fill login form
agent-browser fill @{email-input} "admin@fetchtext.local"
agent-browser fill @{password-input} "***REMOVED-TEST-PASSWORD***"
agent-browser click @{login-button}
agent-browser wait --url "**/dashboard"
```

### 2. Document Upload

```bash
agent-browser snapshot -i
agent-browser click @{upload-button}
agent-browser upload @{file-input} test-document.pdf
agent-browser wait --text "Upload complete"
```

### 3. Template Gallery

```bash
agent-browser open http://localhost:5173/templates
agent-browser wait --load networkidle
agent-browser snapshot -i
```

**Verify:**
- Templates are visible in gallery
- Categories are populated
- Search/filter works

---

## Full Validation Checklist

- [ ] Backend health check passes
- [ ] Frontend loads without errors
- [ ] Login works with admin credentials
- [ ] Dashboard renders correctly
- [ ] Document upload works
- [ ] Template gallery displays templates
- [ ] Settings page accessible
- [ ] Error states handled gracefully

---

## Tips

1. **Always re-snapshot** after page changes - element refs change after DOM updates
2. **Use `wait --load networkidle`** after actions that trigger API calls
3. **Check console errors** with `agent-browser errors` if something seems wrong
4. **Use `--headed` mode** for debugging: `agent-browser open http://localhost:5173 --headed`
