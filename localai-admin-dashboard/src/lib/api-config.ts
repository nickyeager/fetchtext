/**
 * Centralized API configuration
 * All backend service URLs should be accessed through this module
 */

/**
 * Document Processor backend URL
 * MUST be set via VITE_DOCUMENT_PROCESSOR_URL environment variable
 * No localhost fallback - production builds must have this configured
 */
export const DOCUMENT_PROCESSOR_URL = import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || '';

// Warn in development if not configured
if (!DOCUMENT_PROCESSOR_URL && import.meta.env.DEV) {
  console.warn(
    '[API Config] VITE_DOCUMENT_PROCESSOR_URL is not set. Document processing features will not work.'
  );
}

/**
 * Document Processor API endpoints
 */
export const API_ENDPOINTS = {
  // Enhanced document processing
  enhancedDocuments: `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents`,
  smartExtract: `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/smart-extract`,
  evaluate: `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/evaluate`,
  fieldPositions: `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/field-positions`,
  indexTemplateEmbedding: `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/index-template-embedding`,

  // Model management
  models: `${DOCUMENT_PROCESSOR_URL}/models`,
  modelsSelect: `${DOCUMENT_PROCESSOR_URL}/models/select`,
  modelsCurrent: `${DOCUMENT_PROCESSOR_URL}/models/current`,
  modelsProvider: `${DOCUMENT_PROCESSOR_URL}/models/provider`,

  // Email service
  emailSendInvitation: `${DOCUMENT_PROCESSOR_URL}/api/email/send-invitation`,

  // Health check
  health: `${DOCUMENT_PROCESSOR_URL}/health`,
} as const;

/**
 * Get document-specific endpoint
 */
export function getDocumentEndpoint(
  documentId: string,
  action: 'reprocess' | 'download' | 'details'
): string {
  return `${DOCUMENT_PROCESSOR_URL}/api/documents/${documentId}/${action}`;
}
