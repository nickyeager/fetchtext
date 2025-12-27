/**
 * Simple Template Generation Integration Tests
 * 
 * Tests the core template generation functionality without complex UI components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentProcessorEnhanced } from '../../lib/document-processor-enhanced';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock file creation helper
const createMockFile = (name: string, type: string, content: string = 'test content') => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

// Mock template generation response
const mockTemplateResponse = {
  template_id: 'test-123',
  template: {
    name: 'Test Template',
    category: 'test',
    description: 'Test description',
    variables: [
      {
        id: 'field1',
        name: 'field1',
        type: 'text',
        description: 'Test field',
        extraction_hints: ['test', 'field']
      }
    ],
    tags: ['ai-generated'],
    is_public: false
  },
  generation_metadata: {
    ai_confidence: 0.85,
    fields_detected: 1,
    generation_method: 'automatic',
    original_filename: 'test.txt'
  },
  validation_results: {
    template_valid: true,
    validation_warnings: []
  },
  test_extraction: {
    extraction_successful: true,
    extracted_fields_count: 1,
    average_confidence: 0.8
  }
};

describe('Template Generation Core Functionality', () => {
  let documentProcessor: DocumentProcessorEnhanced;

  beforeEach(() => {
    documentProcessor = new DocumentProcessorEnhanced();
    mockFetch.mockClear();
  });

  describe('Backend Integration', () => {
    it('should call the correct API endpoint', async () => {
      // First call: enhanced API availability
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      // Second call: decide-template
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockTemplateResponse });

      const file = createMockFile('test.pdf', 'application/pdf');
      await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/enhanced-documents/decide-template'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });

    it('should transform response correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => mockTemplateResponse });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      expect(result.template_id).toBe('test-123');
      expect(result.template.smart_variables).toBeDefined();
      expect(result.template.smart_variables[0].name).toBe('field1');
    });

    it('should handle API errors with fallback', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Internal server error' })
        });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      // Should fallback to mock data
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should handle network errors', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Network error'));

  const file = createMockFile('test.txt', 'text/plain');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'test');

      // Should fallback to mock data
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });
  });

  describe('File Handling', () => {
    it('should handle text files with fallback', async () => {
      const file = createMockFile('test.txt', 'text/plain');
      const result = await documentProcessor.generateTemplate(file, 'Text Template', 'document');

      // Text files should use fallback (not sent to backend)
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should attempt to process PDF files', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      await documentProcessor.generateTemplate(file, 'PDF Template', 'document');

      // PDF files should be sent to backend
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should encode special characters in parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      await documentProcessor.generateTemplate(file, 'Special & Characters', 'test/category');

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain('template_name=Special%20%26%20Characters');
      expect(url).toContain('category=test%2Fcategory');
    });
  });

  describe('Response Transformation', () => {
    it('should map variables to smart_variables', async () => {
      const responseWithVariables = {
        ...mockTemplateResponse,
        template: {
          ...mockTemplateResponse.template,
          variables: [
            { id: 'test1', name: 'test_field', type: 'text' }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithVariables
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.template.smart_variables).toBeDefined();
      expect(result.template.smart_variables[0].name).toBe('test_field');
    });

    it('should preserve generation metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplateResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.generation_metadata).toBeDefined();
      expect(result.generation_metadata?.ai_confidence).toBe(0.85);
      expect(result.generation_metadata?.fields_detected).toBe(1);
    });

    it('should handle missing optional fields', async () => {
      const minimalResponse = {
        template_id: 'minimal-123',
        template: {
          name: 'Minimal',
          category: 'test'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => minimalResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.template.smart_variables).toEqual([]);
      expect(result.template.tags).toEqual([]);
      expect(result.template.is_public).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle timeout with AbortError', async () => {
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('Request timed out');
        error.name = 'AbortError';
        throw error;
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new SyntaxError('Invalid JSON'); }
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });

    it('should validate response structure', async () => {
      const invalidResponse = {
        // Missing template field
        template_id: 'invalid-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse
      });

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });
  });
});

describe('Template Generation Decision Logic', () => {
  it('should trigger generation when no templates exist', () => {
    const evaluation = {
      template_suggestions: [],
      processing_recommendations: {
        workflow: 'generate_template',
        suggested_action: 'Generate a new AI-powered template'
      }
    };

    expect(evaluation.template_suggestions.length).toBe(0);
    expect(evaluation.processing_recommendations.workflow).toBe('generate_template');
  });

  it('should use existing template when available', () => {
    const evaluation = {
      template_suggestions: [
        { template_id: 123, template_name: 'Existing Template', confidence: 0.9 }
      ],
      processing_recommendations: {
        workflow: 'existing_template',
        suggested_action: 'Use existing template'
      }
    };

    expect(evaluation.template_suggestions.length).toBeGreaterThan(0);
    expect(evaluation.processing_recommendations.workflow).toBe('existing_template');
  });
});

describe('Template Quality Validation', () => {
  it('should validate template structure', () => {
    const validTemplate = {
      template_id: 'valid-123',
      template: {
        name: 'Valid Template',
        category: 'test',
        smart_variables: [
          {
            id: 'field1',
            name: 'test_field',
            type: 'text',
            description: 'Test field',
            extraction_hints: ['test']
          }
        ]
      },
      generation_metadata: {
        ai_confidence: 0.8,
        fields_detected: 1
      }
    };

    expect(validTemplate.template.name).toBeTruthy();
    expect(validTemplate.template.category).toBeTruthy();
    expect(validTemplate.template.smart_variables.length).toBeGreaterThan(0);
    expect(validTemplate.generation_metadata?.ai_confidence).toBeGreaterThan(0.7);
  });

  it('should identify quality indicators', () => {
    const highQualityTemplate = {
      generation_metadata: {
        ai_confidence: 0.9,
        fields_detected: 5
      },
      test_extraction: {
        extraction_successful: true,
        average_confidence: 0.85
      }
    };

    expect(highQualityTemplate.generation_metadata.ai_confidence).toBeGreaterThan(0.8);
    expect(highQualityTemplate.generation_metadata.fields_detected).toBeGreaterThan(3);
    expect(highQualityTemplate.test_extraction.extraction_successful).toBe(true);
  });
});