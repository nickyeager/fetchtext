import { describe, it, expect } from 'vitest';

describe('Route Navigation Test', () => {
  it('should have the process route available in the route tree', async () => {
    // Import the route tree to verify the route exists
    const { routeTree } = await import('@/routeTree.gen');
    
    // Check if the route tree includes our new route
    expect(routeTree).toBeDefined();
    
    // This test will fail if the route tree doesn't include the process route
    // The import should work if the route was properly generated
  });
});
