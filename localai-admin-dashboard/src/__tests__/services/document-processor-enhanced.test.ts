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
        success: true,
        data: {
          content: 'Extracted text content',
          metadata: {
            title: 'Test Document',
            author: 'Test Author',
            pages: 5,
            format: 'pdf',
            size: 1024
          },
          structure: {
            headings: ['Introduction', 'Main Content', 'Conclusion'],
            tables: [],
            images: []
          },
          templateSuggestions: [
            {
              templateId: 'template-123',
              templateName: 'Business Report',
              confidence: 0.85,
              matchReasons: ['document structure', 'content type']
            }
          ]
        }
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await documentProcessor.processDocumentWithDocling(mockFile);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8001/api/documents/process-enhanced',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.metadata).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.templateSuggestions).toBeDefined();
      expect(result.templateSuggestions[0].confidence).toBeGreaterThan(0.8);
    });

    it('should handle processing errors gracefully', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Processing failed' }),
      } as Response);

      await expect(
        documentProcessor.processDocumentWithDocling(mockFile)
      ).rejects.toThrow('Failed to process document: Processing failed');
    });

    it('should validate supported file formats', async () => {
      const unsupportedFile = new File(['test'], 'test.xyz', { type: 'application/xyz' });

      await expect(
        documentProcessor.processDocumentWithDocling(unsupportedFile)
      ).rejects.toThrow('Unsupported file format: application/xyz');
    });
  });

  describe('extractDocumentStructure', () => {
    it('should extract hierarchical document structure', async () => {
      const mockStructuredData = {
        content: 'Test content',
        structure: {
          headings: [
            { level: 1, text: 'Chapter 1', position: 0 },
            { level: 2, text: 'Section 1.1', position: 100 },
            { level: 2, text: 'Section 1.2', position: 200 }
          ],
          tables: [
            { position: 150, rows: 3, columns: 2 }
          ],
          images: [
            { position: 50, alt: 'Figure 1', dimensions: { width: 300, height: 200 } }
          ]
        }
      };

      const structure = await documentProcessor.extractDocumentStructure(mockStructuredData);

      expect(structure).toBeDefined();
      expect(structure.headings).toHaveLength(3);
      expect(structure.tables).toHaveLength(1);
      expect(structure.images).toHaveLength(1);
      expect(structure.headings[0].level).toBe(1);
      expect(structure.headings[1].level).toBe(2);
    });
  });

  describe('generatePreview', () => {
    it('should generate preview with format-specific rendering', async () => {
      const mockProcessedDocument = {
        content: 'Test document content',
        metadata: { format: 'pdf', pages: 2 },
        structure: { headings: [], tables: [], images: [] }
      };

      const preview = await documentProcessor.generatePreview(mockProcessedDocument);

      expect(preview).toBeDefined();
      expect(preview.thumbnailUrl).toBeDefined();
      expect(preview.previewText).toBeDefined();
      expect(preview.metadata).toEqual(mockProcessedDocument.metadata);
    });

    it('should handle different document formats', async () => {
      const formats = ['pdf', 'docx', 'pptx', 'xlsx'];
      
      for (const format of formats) {
        const mockDoc = {
          content: `Test ${format} content`,
          metadata: { format, pages: 1 },
          structure: { headings: [], tables: [], images: [] }
        };

        const preview = await documentProcessor.generatePreview(mockDoc);
        expect(preview.metadata.format).toBe(format);
      }
    });
  });

  describe('getSupportedFormats', () => {
    it('should return comprehensive list of supported formats', () => {
      const formats = documentProcessor.getSupportedFormats();

      expect(formats).toContain('application/pdf');
      expect(formats).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(formats).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation');
      expect(formats).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(formats).toContain('text/html');
      expect(formats).toContain('text/plain');
    });
  });

  describe('batchProcessDocuments', () => {
    it('should process multiple documents concurrently', async () => {
      const mockFiles = [
        new File(['content1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'doc2.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      ];

      const mockResponses = mockFiles.map((file, index) => ({
        success: true,
        data: {
          content: `Content ${index + 1}`,
          metadata: { title: `Document ${index + 1}`, format: file.type },
          structure: { headings: [], tables: [], images: [] },
          templateSuggestions: []
        }
      }));

      mockResponses.forEach((response, index) => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => response,
        } as Response);
      });

      const results = await documentProcessor.batchProcessDocuments(mockFiles);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.title).toBe('Document 1');
      expect(results[1].metadata.title).toBe('Document 2');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch processing', async () => {
      const mockFiles = [
        new File(['content1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'doc2.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      ];

      // First request succeeds, second fails
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { content: 'Content 1', metadata: {}, structure: {}, templateSuggestions: [] }
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Processing failed' }),
        } as Response);

      const results = await documentProcessor.batchProcessDocuments(mockFiles, { continueOnError: true });

      expect(results).toHaveLength(1); // Only successful results
      expect(results[0].content).toBe('Content 1');
    });
  });
});
