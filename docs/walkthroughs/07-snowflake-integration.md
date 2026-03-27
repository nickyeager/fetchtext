# Walkthrough 7: Snowflake Integration

**Josh's ask:** "Show the Snowflake integration"

**Status:** Has Gaps

---

## Steps (Current State)

### 1. Navigate to Settings > Integrations
- Sidebar: Settings > Integrations
- URL: `/settings/integrations`

### 2. Find Snowflake Card
- The Snowflake integration card shows up in the integrations list
- Shows connection status and "Configure" button

### 3. Configure Credentials
- Click **Configure** on the Snowflake card
- Enter credentials:
  - Account identifier (e.g., `uzdboxw-snb92059`)
  - Username
  - Private key (RSA key-pair authentication)
  - Database, Schema, Warehouse

### 4. Test Connection
- Click **Test Connection** to verify credentials
- Should show "Connected" status

### 5. Import from Snowflake (Current Flow)
- Navigate to Documents > Snowflake Import (if route still exists)
- Or use the API directly

---

## Demo Script (Adapted for Gaps)

> "We have a Snowflake integration that lets you pull documents stored in Snowflake stages. You configure your credentials in Settings, then you can import files from internal or external stages."
>
> "For the demo, I'll show the configuration and connection test. The actual import flow pulls files from Snowflake stages, extracts text, and runs them through the same processing pipeline."

---

## Gaps

| Gap | Impact | Priority | Notes |
|-----|--------|----------|-------|
| **Snowflake Import route was removed** | Can't demo the import flow from UI | HIGH | Route `/documents/snowflake-import` was removed in sidebar cleanup. Need to either restore it under Settings or add an import button to the Snowflake integration config page. |
| **OAuth flow not tested** | Key-pair auth works, OAuth (Phase 2-3) is code-complete but untested | MEDIUM | For enterprise demos, OAuth SSO would be more impressive than key-pair |
| **No "browse Snowflake stages" UI** | Users can't visually browse what's in their Snowflake stage | LOW | Currently relies on knowing stage names. A file browser would be more demo-friendly. |
| **Import results not shown** | After importing, no confirmation of what was imported | LOW | Should show import summary with document count and processing status |

---

## Recommended Fix for Demo

**Quick fix:** Add a "Import Documents" button to the Snowflake integration configuration page in Settings > Integrations. When clicked, it opens a simple form:
- Stage name (text input)
- File pattern (optional, e.g., `*.pdf`)
- "Import" button that triggers batch import

This avoids needing a separate route while keeping the import flow accessible.
