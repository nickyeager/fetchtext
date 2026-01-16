import { afterEach, beforeEach } from 'vitest';

// Check if we're in a browser-like environment (jsdom, happy-dom, etc.)
const isBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';

if (isBrowserEnv) {
  // Import browser-specific testing utilities only in browser environment
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  // Mock ResizeObserver (required for Radix UI components like Tooltip)
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  // Ensure DOM cleanup between all tests to prevent multiple element issues
  beforeEach(() => {
    // Clear DOM before each test
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up React components
    cleanup();
    // Clear any remaining DOM content
    document.body.innerHTML = '';
  });
}