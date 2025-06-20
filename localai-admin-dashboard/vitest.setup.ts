import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

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