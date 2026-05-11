# E2E Test URL Reference

TanStack Router uses filesystem-based routing where certain directory naming
conventions affect URL generation:

- **Parenthesized dirs `(auth)`** — pathless layout groups (NOT part of the URL)
- **Underscore-prefixed dirs `_authenticated`** — layout routes (NOT part of the URL)

## Correct Browser URLs

| Route File Path | Browser URL |
|----------------|-------------|
| `(auth)/sign-in.tsx` | `/sign-in` |
| `(auth)/sign-up.tsx` | `/sign-up` |
| `(auth)/forgot-password.tsx` | `/forgot-password` |
| `(auth)/reset-password.tsx` | `/reset-password` |
| `(auth)/otp.tsx` | `/otp` |
| `(auth)/signup-confirmation.tsx` | `/signup-confirmation` |
| `_authenticated/dashboard.tsx` | `/dashboard` |
| `_authenticated/documents.tsx` | `/documents` |
| `_authenticated/documents/upload.tsx` | `/documents/upload` |
| `_authenticated/documents/gallery.tsx` | `/documents/gallery` |
| `_authenticated/documents/$documentId.tsx` | `/documents/{id}` |
| `_authenticated/templates/index.tsx` | `/templates` |
| `_authenticated/templates/$templateId.tsx` | `/templates/{id}` |
| `_authenticated/templates/$templateId/edit.tsx` | `/templates/{id}/edit` |
| `_authenticated/settings/index.tsx` | `/settings` |
| `_authenticated/settings/account.tsx` | `/settings/account` |
| `_authenticated/settings/ai-models.tsx` | `/settings/ai-models` |
| `_authenticated/settings/integrations.tsx` | `/settings/integrations` |
| `_authenticated/settings/webhooks.tsx` | `/settings/webhooks` |
| `_authenticated/settings/organization.tsx` | `/settings/organization` |
| `_authenticated/settings/notifications.tsx` | `/settings/notifications` |
| `_authenticated/settings/appearance.tsx` | `/settings/appearance` |
| `_authenticated/settings/billing.tsx` | `/settings/billing` |
| `_authenticated/settings/developer.tsx` | `/settings/developer` |

## Common Mistakes

```typescript
// WRONG — /(auth) is a pathless group, not a URL segment
await page.goto('/(auth)/sign-in');

// WRONG — _authenticated is a layout route, not a URL segment
await page.goto('/_authenticated/dashboard');

// CORRECT
await page.goto('/sign-in');
await page.goto('/dashboard');
await page.goto('/documents/upload');
```
