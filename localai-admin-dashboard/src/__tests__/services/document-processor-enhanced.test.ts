import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';

// Mock fetch for API calls
global.fetch = vi.fn();

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
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const mockResponse = {
        content: {
          text: 'Extracted text content from PDF',
          layout_info: {
            headings: [
              { level: 1, text: 'Introduction', position: 0 },
              { level: 2, text: 'Overview', position: 100 }
            ]
          },
          tables: [
            { data: [['Header 1', 'Header 2'], ['Data 1', 'Data 2']], caption: 'Sample Table' }
          ],
          images: [
            { caption: 'Sample Image', dimensions: { width: 800, height: 600 } }
          ]
        },
        metadata: {
          title: 'Test Document',
          author: 'Test Author',
          pages: 5,
          format: 'pdf',
          size: 1024
        },
        processing_method: 'real_docling',
        processing_time: 1.5,
        status: 'completed'
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await documentProcessor.processDocumentWithDocling(mockFile);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8090/documents/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.templateSuggestions).toBeDefined();
      expect(result.content).toBe('Extracted text content from PDF');
    });

    it('should handle backend errors gracefully', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Processing failed' }),
      } as Response);

      await expect(documentProcessor.processDocumentWithDocling(mockFile))
        .rejects.toThrow('Failed to process document: Processing failed');
    });

    it('should fall back to mock data when backend is unavailable', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await documentProcessor.processDocumentWithDocling(mockFile);

      expect(result).toBeDefined();
      expect(result.metadata.title).toBe('Test Document');
      expect(result.structure.headings).toHaveLength(4);
    });

    it('should reject unsupported file formats', async () => {
      const unsupportedFile = new File(['content'], 'test.xyz', { type: 'application/unsupported' });

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
        new File(['content 1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['content 2'], 'doc2.txt', { type: 'text/plain' })
      ];

      // Mock successful responses for both files
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: { text: 'Processed content 1' },
            metadata: { title: 'Document 1' },
            processing_method: 'real_docling'
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: { text: 'Processed content 2' },
            metadata: { title: 'Document 2' },
            processing_method: 'real_docling'
          }),
        } as Response);

      const results = await documentProcessor.batchProcessDocuments(files);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.title).toBe('Document 1');
      expect(results[1].metadata.title).toBe('Document 2');
    });

    it('should handle errors in batch processing with continueOnError', async () => {
      const files = [
        new File(['content 1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['content 2'], 'doc2.txt', { type: 'text/plain' })
      ];

      // Mock one success, one failure
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: { text: 'Processed content 1' },
            metadata: { title: 'Document 1' },
            processing_method: 'real_docling'
          }),
        } as Response)
        .mockRejectedValueOnce(new Error('Processing failed'));

      const results = await documentProcessor.batchProcessDocuments(files, { continueOnError: true });

      expect(results).toHaveLength(1);
      expect(results[0].metadata.title).toBe('Document 1');
    });

    it('should throw error in batch processing without continueOnError', async () => {
      const files = [
        new File(['content 1'], 'doc1.pdf', { type: 'application/pdf' })
      ];

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Processing failed'));

      await expect(documentProcessor.batchProcessDocuments(files, { continueOnError: false }))
        .rejects.toThrow('Processing failed');
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
});
