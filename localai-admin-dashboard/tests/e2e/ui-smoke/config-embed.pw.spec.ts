import { test, expect } from '@playwright/test'

// Verifies the production bundle embeds the host-accessible Supabase URL
// rather than Docker-internal DNS names. This catches regressions where
// VITE_SUPABASE_URL is accidentally built as `http://kong:8000`.

test('frontend bundle embeds localhost Supabase URL', async ({ request }) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5174'

  // Load the root page and extract a JS asset path
  const res = await request.get(base)
  expect(res.ok()).toBeTruthy()
  const html = await res.text()

  const assetMatch = html.match(/['"](\/assets\/[^'"]+\.js)['"]/)
  expect(assetMatch, 'could not locate a JS asset in index.html').toBeTruthy()
  const assetPath = assetMatch![1]

  const assetUrl = new URL(assetPath, base).toString()
  const js = await (await request.get(assetUrl)).text()

  // Positive assertion: correct host URL is present
  expect(js).toContain('http://localhost:8000')

  // Negative assertion: no Docker-internal hostnames leak into browser bundle
  expect(js).not.toContain('http://kong:8000')
  expect(js).not.toContain('supabase-kong:8000')
})
