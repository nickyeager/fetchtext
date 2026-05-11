import { Page, TestInfo } from '@playwright/test';

// Waits until the React app has hydrated by checking #root contents.
export async function waitForAppHydration(page: Page, timeout = 7000) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return !!root && root.childElementCount > 0 && root.innerHTML.length > 20;
  }, { timeout });
}

// Navigate using a relative path (Playwright baseURL applies) and assert success + hydration.
export async function gotoAndHydrate(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  } catch {
    // In SPAs, immediate client redirects can abort the initial navigation.
    // We'll still proceed to wait for hydration.
  }
  await waitForAppHydration(page);
}

// Capture diagnostic artifacts when nothing loads.
export async function attachDiagnostics(page: Page, info: TestInfo, label: string) {
  try {
    const html = await page.content();
    await info.attach(`${label}-dom.html`, { body: html, contentType: 'text/html' });
  } catch {
    // no-op
  }
}

// Try multiple candidate routes, returning the first hydrated path or null.
export async function findHydratableRoute(page: Page, routes: string[]) {
  for (const r of routes) {
    try {
      await page.goto(r, { waitUntil: 'domcontentloaded' });
    } catch {
      // Ignore aborted navigations; SPA may redirect immediately.
    }
    // Try a quick hydration check; tolerate transient blank states
    try {
      await waitForAppHydration(page, 3000);
      const title = await page.title();
      if (/FetchText Admin/.test(title)) return r;
      // If title isn't set yet but DOM hydrated, still accept
      const hydrated = await page.evaluate(() => {
        const root = document.getElementById('root');
        return !!root && root.childElementCount > 0 && root.innerHTML.length > 20;
      });
      if (hydrated) return r;
    } catch {
      // Not hydrated, try next route
    }
  }
  return null;
}
