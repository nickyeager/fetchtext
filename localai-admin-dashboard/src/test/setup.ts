/**
 * Test setup utilities shared across test files
 */

// Re-export commonly used test utilities
export * from './test-utils';

// Common test data
export const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};

export const TEST_DOCUMENT = {
  id: 'test-doc-id',
  name: 'test-document.pdf',
  file_type: 'application/pdf',
  processing_status: 'uploaded' as const,
  created_at: new Date().toISOString(),
  created_by: TEST_USER.id,
};

export const TEST_TEMPLATE = {
  id: 1,
  name: 'Test Template',
  description: 'A test template',
  template_content: 'Hello {{name}}',
  category_id: 1,
  is_public: false,
  created_by: TEST_USER.id,
};