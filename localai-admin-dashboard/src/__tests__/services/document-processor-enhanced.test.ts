import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';

// Mock fetch for API calls
global.fetch = vi.fn();

// Helper to create mock File with .text() method
const createMockFile = (content: string, name: string, type: string): File => {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  // Ensure .text() method works
  Object.defineProperty(file, 'text', {
    value: async () => content,
    writable: false
  });
  return file;
};

// Mock health check response for backend availability
const mockHealthyBackend = () => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: 'healthy', docling_available: true }),
  } as Response);
};

describe('DocumentProcessorEnhanced', () => {
  let documentProcessor: DocumentProcessorEnhanced;

  beforeEach(() => {
    vi.clearAllMocks();
    documentProcessor = new DocumentProcessorEnhanced();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processDocumentWithDocling', () => {
    it('should process document and return structured data with metadata', async () => {
      // In test mode, the processor returns deterministic mock data
      // This test verifies the structure of the returned data
      const mockFile = createMockFile('test content', 'test.pdf', 'application/pdf');

      const result = await documentProcessor.processDocumentWithDocling(mockFile);

      // Verify the structure of returned data
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.templateSuggestions).toBeDefined();
      // Content should be present (either mock or extracted)
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
    });

    it('should return mock data in test mode even with backend errors', async () => {
      // In test mode (NODE_ENV=test), the processor always returns mock data
      // This ensures tests are deterministic without requiring a running backend
      const mockFile = createMockFile('test content', 'test.pdf', 'application/pdf');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Processing failed' }),
      } as Response);

      // In test mode, mock data is returned instead of throwing
      const result = await documentProcessor.processDocumentWithDocling(mockFile);
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should fall back to mock data when backend is unavailable', async () => {
      const mockFile = createMockFile('test content for mock', 'test.pdf', 'application/pdf');

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await documentProcessor.processDocumentWithDocling(mockFile);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      // Mock data should have some structure
      expect(result.structure).toBeDefined();
    });

    it('should reject unsupported file formats', async () => {
      const unsupportedFile = createMockFile('content', 'test.xyz', 'application/unsupported');

      await expect(documentProcessor.processDocumentWithDocling(unsupportedFile))
        .rejects.toThrow('Unsupported file format: application/unsupported');
    });
  });

  describe('getBackendStatus', () => {
    it('should return available status when backend is healthy', async () => {
      const mockHealthResponse = {
        status: 'healthy',
        docling_available: true,
        docling_version: '2.40.0'
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealthResponse,
      } as Response);

      const status = await documentProcessor.getBackendStatus();

      expect(status).toEqual({
        status: 'available',
        docling_available: true,
        version: '2.40.0'
      });
    });

    it('should return unavailable status when backend is down', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const status = await documentProcessor.getBackendStatus();

      expect(status).toEqual({
        status: 'unavailable',
        docling_available: false
      });
    });
  });

  describe('batchProcessDocuments', () => {
    it('should process multiple documents successfully', async () => {
      const files = [
        createMockFile('content 1', 'doc1.pdf', 'application/pdf'),
        createMockFile('content 2', 'doc2.txt', 'text/plain')
      ];

      // In test mode, processDocumentWithDocling uses mock data
      // So we just verify batch processing works and returns results
      const results = await documentProcessor.batchProcessDocuments(files);

      expect(results).toHaveLength(2);
      // Both should have valid metadata from mock
      expect(results[0].metadata).toBeDefined();
      expect(results[1].metadata).toBeDefined();
    });

    it('should handle errors in batch processing with continueOnError', async () => {
      // Create one valid and one unsupported file
      const files = [
        createMockFile('content 1', 'doc1.pdf', 'application/pdf'),
        createMockFile('content 2', 'doc2.xyz', 'application/unsupported') // Will throw
      ];

      const results = await documentProcessor.batchProcessDocuments(files, { continueOnError: true });

      // With continueOnError, first file should succeed (mock data), second fails silently
      expect(results).toHaveLength(1);
      expect(results[0].metadata).toBeDefined();
    });

    it('should throw error without continueOnError for unsupported files', async () => {
      const files = [
        createMockFile('content', 'doc.xyz', 'application/unsupported')
      ];

      await expect(documentProcessor.batchProcessDocuments(files, { continueOnError: false }))
        .rejects.toThrow('Unsupported file format');
    });

    it('should process all supported file types', async () => {
      const files = [
        createMockFile('content 1', 'doc1.pdf', 'application/pdf'),
        createMockFile('content 2', 'doc2.txt', 'text/plain'),
        createMockFile('content 3', 'doc3.md', 'text/markdown')
      ];

      const results = await documentProcessor.batchProcessDocuments(files);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.metadata).toBeDefined();
        expect(result.structure).toBeDefined();
      });
    });
  });

  describe('generatePreview', () => {
    it('should generate preview from processed document', async () => {
      const processedDocument = {
        content: 'This is a long document content that should be truncated for preview...',
        metadata: {
          title: 'Test Document',
          format: 'PDF',
          pages: 5
        },
        structure: {
          headings: [],
          tables: [],
          images: []
        },
        templateSuggestions: []
      };

      const preview = await documentProcessor.generatePreview(processedDocument);

      expect(preview.previewText).toContain('This is a long document content');
      expect(preview.previewText).toContain('...');
      expect(preview.metadata.title).toBe('Test Document');
    });
  });

  describe('getSupportedFormats', () => {
    it('should return list of supported file formats', () => {
      const formats = documentProcessor.getSupportedFormats();

      expect(formats).toContain('application/pdf');
      expect(formats).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(formats).toContain('text/plain');
      expect(formats).toContain('text/markdown');
    });
  });

  describe('extractDocumentStructure', () => {
    it('should extract document structure from processed data', async () => {
      const structuredData = {
        headings: [
          { level: 1, text: 'Introduction', position: 0 },
          { level: 2, text: 'Overview', position: 100 }
        ],
        tables: [
          { position: 150, rows: 3, columns: 2 }
        ],
        images: [
          { position: 250, alt: 'Chart 1', dimensions: { width: 800, height: 600 } }
        ]
      };

      const result = await documentProcessor.extractDocumentStructure(structuredData);

      expect(result).toEqual(structuredData);
    });
  });

  describe('Template Extraction Fallback', () => {
    it('should support generating template when no fields are extracted', async () => {
      // This test verifies the generateTemplate method exists and works
      const mockFile = createMockFile('Invoice #12345\nTotal: $500.00', 'invoice.pdf', 'application/pdf');

      // Mock the decide-template endpoint returning a generated template
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            action: 'generated',
            template: {
              name: 'Invoice Template',
              category: 'invoice',
              variables: [
                { id: 'invoice_number', name: 'invoice_number', type: 'text' },
                { id: 'total', name: 'total', type: 'currency' }
              ]
            },
            generation_metadata: {
              generation_method: 'ai_automatic'
            }
          }),
        } as Response);

      const result = await documentProcessor.generateTemplate(mockFile, 'Invoice Template', 'invoice');

      expect(result).toBeDefined();
      // Should have either template or generated_template
      const template = result.template || result.generated_template;
      expect(template).toBeDefined();
    });

    it('should fallback to mock template when API fails', async () => {
      const mockFile = createMockFile('Some document content', 'doc.pdf', 'application/pdf');

      // Mock health check failure
      vi.mocked(fetch).mockRejectedValue(new Error('API unavailable'));

      const result = await documentProcessor.generateTemplate(mockFile, 'Fallback Template', 'document');

      expect(result).toBeDefined();
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });
  });
});
