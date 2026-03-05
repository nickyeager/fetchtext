import { test, expect } from '@playwright/test'

// Verifies the production bundle embeds a host-accessible Supabase URL
// rather than Docker-internal DNS names. This catches regressions where
// VITE_SUPABASE_URL is accidentally built as `http://kong:8000`.
//
// The actual URL depends on .env.local configuration:
// - Direct Kong: http://localhost:8000
// - Vite proxy:  http://localhost:5173/supabase

test('frontend bundle embeds localhost Supabase URL', async ({ request }) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173'

  // Load the root page and extract a JS asset path
  const res = await request.get(base)
  expect(res.ok()).toBeTruthy()
  const html = await res.text()

  const assetMatch = html.match(/['"](\/assets\/[^'"]+\.js)['"]/)
  expect(assetMatch, 'could not locate a JS asset in index.html').toBeTruthy()
  const assetPath = assetMatch![1]

  const assetUrl = new URL(assetPath, base).toString()
  const js = await (await request.get(assetUrl)).text()

  // Positive assertion: a localhost Supabase URL is present
  // Accepts either direct Kong (http://localhost:8000) or Vite proxy (http://localhost:5173/supabase)
  const hasDirectKong = js.includes('http://localhost:8000')
  const hasViteProxy = js.includes('http://localhost:5173/supabase')
  expect(
    hasDirectKong || hasViteProxy,
    `Expected bundle to contain a localhost Supabase URL (http://localhost:8000 or http://localhost:5173/supabase), but found neither`,
  ).toBe(true)

  // Negative assertion: no Docker-internal hostnames leak into browser bundle
  expect(js).not.toContain('http://kong:8000')
  expect(js).not.toContain('supabase-kong:8000')
})
