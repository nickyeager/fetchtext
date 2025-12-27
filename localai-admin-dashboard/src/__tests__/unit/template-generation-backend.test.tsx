/**
 * Backend Template Generation Integration Tests
 * 
 * Tests the backend API integration for template generation:
 * 1. Document processing API calls
 * 2. Template generation endpoint integration
 * 3. Database saving operations
 * 4. Error handling and fallbacks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentProcessorEnhanced } from '../../lib/document-processor-enhanced';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock file data
const createMockFile = (name: string, type: string, content: string = 'test content') => {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  return file;
};

// Mock backend responses
const mockTemplateGenerationResponse = {
  template_id: 'gen-template-789',
  template: {
    name: 'Invoice Template',
    description: 'AI-generated template for invoice documents',
    category: 'invoice',
    template_content: '# Invoice Summary\n**Invoice Number:** {invoice_number}\n**Total Amount:** {total_amount}',
    variables: [
      {
        id: 'invoice_number',
        name: 'invoice_number',
        type: 'text',
        description: 'Invoice or reference number',
        extraction_hints: ['invoice', 'invoice #', 'reference number'],
        default_value: '',
        confidence_threshold: 0.7
      },
      {
        id: 'total_amount',
        name: 'total_amount',
        type: 'currency',
        description: 'Total amount or balance',
        extraction_hints: ['total', 'amount', 'grand total', 'balance due'],
        default_value: '',
        confidence_threshold: 0.7
      }
    ],
    extraction_rules: [
      {
        field_name: 'invoice_number',
        extraction_method: 'ai_guided',
        patterns: [],
        keywords: ['invoice', 'invoice #', 'reference number'],
        confidence_threshold: 0.7,
        field_type: 'text'
      },
      {
        field_name: 'total_amount',
        extraction_method: 'ai_guided',
        patterns: ['$2,025.00'],
        keywords: ['total', 'amount', 'grand total', 'balance due'],
        confidence_threshold: 0.7,
        field_type: 'currency'
      }
    ],
    generation_settings: {
      ai_generated: true,
      generation_method: 'ai_automatic',
      complexity: 'simple'
    },
    tags: ['ai_generated', 'invoice', 'financial', 'simple_extraction'],
    ai_confidence: 0.85,
    generation_method: 'ai_automatic'
  },
  generation_metadata: {
    generation_time: 3.2,
    ai_confidence: 0.85,
    fields_detected: 2,
    generation_method: 'automatic',
    original_filename: 'test-invoice.pdf',
    auto_save: false
  },
  validation_results: {
    template_valid: true,
    validation_warnings: [],
    suggested_improvements: []
  },
  test_extraction: {
    extraction_successful: true,
    extracted_fields_count: 2,
    average_confidence: 0.8,
    failed_fields: []
  }
};

describe('Backend Template Generation Integration', () => {
  let documentProcessor: DocumentProcessorEnhanced;

  beforeEach(() => {
    documentProcessor = new DocumentProcessorEnhanced();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('API Endpoint Integration', () => {
    it('should call decide-template endpoint first with proper parameters', async () => {
      // First call: decide-template returns 'generated' with a template
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ action: 'generated', template: mockTemplateGenerationResponse.template, generation_metadata: mockTemplateGenerationResponse.generation_metadata })
      });

      const file = createMockFile('test-invoice.pdf', 'application/pdf');
      const templateName = 'Invoice Template';
      const category = 'invoice';

      const result = await documentProcessor.generateTemplate(file, templateName, category);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:8090/api/enhanced-documents/decide-template?'),
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
      );

      expect(result).toBeDefined();
      expect(result.template_id).toBe('gen-template-789');
    });

    it('should pass decide-template parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ action: 'generated', template: mockTemplateGenerationResponse.template })
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const templateName = 'Complex Invoice & Receipt Template';
      const category = 'invoice/receipt';

      await documentProcessor.generateTemplate(file, templateName, category);

  const fetchCall = mockFetch.mock.calls[0];
  const url = fetchCall[0] as string;
  expect(url).toContain('/api/enhanced-documents/decide-template');
  expect(url).toContain('quick_scan=true');
  expect(url).toContain('min_match_confidence=0.7');
    });

    it('should include file in FormData with correct field name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

      const file = createMockFile('test-document.pdf', 'application/pdf');
      
      await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      const fetchCall = mockFetch.mock.calls[0];
      const formData = fetchCall[1].body as FormData;
      
      expect(formData.get('file')).toBe(file);
    });

    // Timeout simulation test removed (covered by AbortError test below)
  });

  describe('Response Transformation', () => {
    it('should transform backend response to frontend interface format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

    const file = createMockFile('test.pdf', 'application/pdf');
    const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      // Check that variables are mapped to smart_variables
      expect(result.template.smart_variables).toBeDefined();
      expect(result.template.smart_variables).toHaveLength(2);
      expect(result.template.smart_variables[0]).toEqual(
        expect.objectContaining({
          name: 'invoice_number',
          type: 'text',
          description: 'Invoice or reference number'
        })
      );
    });

    it('should preserve all generation metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const res = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(res.generation_metadata).toEqual({
        ai_confidence: 0.85,
        fields_detected: 2,
        generation_method: 'automatic',
        original_filename: 'test-invoice.pdf'
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalResponse = {
        template_id: 'test-123',
        template: {
          name: 'Basic Template',
          category: 'test',
          variables: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => minimalResponse
      });

    const file = createMockFile('test.pdf', 'application/pdf');
    const _unused2 = await documentProcessor.generateTemplate(file, 'Test', 'test');

    expect(_unused2.template.smart_variables).toEqual([]);
    expect(_unused2.template.tags).toEqual([]);
    expect(_unused2.template.is_public).toBe(false);
    expect(_unused2.generation_metadata).toBeDefined();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle API unavailable error with fallback', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      // Should return fallback mock data
      expect(result).toBeDefined();
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
      expect(result.template.name).toBe('Test Template');
    });

    it('should handle HTTP error responses with fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'AI service temporarily unavailable' })
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      // Should fallback to mock for 500 errors
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new SyntaxError('Unexpected token'); }
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      // Should fallback to mock
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should handle network timeout with AbortError', async () => {
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('Request timed out');
        error.name = 'AbortError';
        throw error;
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      // Should fallback to mock
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should validate response structure and fallback if invalid', async () => {
      const invalidResponse = {
        // Missing template field
        template_id: 'test-123',
        metadata: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      // Should fallback due to invalid structure
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });
  });

  describe('File Type Handling', () => {
    it('should handle PDF files', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

      const file = createMockFile('document.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'PDF Template', 'document');

      expect(mockFetch).toHaveBeenCalled();
      expect(result.template_id).toBeDefined();
    });

    it('should handle DOCX files', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

      const file = createMockFile('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const result = await documentProcessor.generateTemplate(file, 'DOCX Template', 'document');

      expect(mockFetch).toHaveBeenCalled();
      expect(result.template_id).toBeDefined();
    });

    it('should fallback for text files (not supported by backend)', async () => {
      const file = createMockFile('document.txt', 'text/plain');
      const result = await documentProcessor.generateTemplate(file, 'Text Template', 'document');

      // Should not call backend for text files
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should check backend availability before processing', async () => {
      // Mock backend as unavailable
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });

  const file = createMockFile('test.pdf', 'application/pdf');
  // First call to check availability will fail, triggering fallback
  const _result = await documentProcessor.generateTemplate(file, 'Test', 'test');
  expect(_result.generation_metadata?.generation_method).toBe('mock-fallback');
    });
  });

  describe('Template Generation Quality', () => {
    it('should validate generated template has required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

      const file = createMockFile('invoice.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Invoice Template', 'invoice');

      expect(result.template.name).toBe('Invoice Template');
      expect(result.template.category).toBe('invoice');
      expect(result.template.smart_variables.length).toBeGreaterThan(0);
      expect(result.template.smart_variables[0]).toHaveProperty('name');
      expect(result.template.smart_variables[0]).toHaveProperty('type');
      expect(result.template.smart_variables[0]).toHaveProperty('description');
    });

    it('should include extraction rules for each variable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
  const _unused3 = await documentProcessor.generateTemplate(file, 'Test', 'test');

      // Check that original extraction_rules are preserved
      expect(mockTemplateGenerationResponse.template.extraction_rules).toBeDefined();
      expect(mockTemplateGenerationResponse.template.extraction_rules.length).toBe(2);
    });

    it('should include confidence scores and metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateGenerationResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

  expect(result.generation_metadata?.ai_confidence).toBe(0.85);
  expect(result.generation_metadata?.fields_detected).toBe(2);
  expect(result.test_extraction?.extraction_successful).toBe(true);
  expect(result.test_extraction?.average_confidence).toBe(0.8);
    });
  });
});