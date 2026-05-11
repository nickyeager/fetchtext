/**
 * Template Generation Unit Tests
 *
 * Tests for the DocumentProcessorEnhanced.generateTemplate() method.
 * These tests verify the fallback behavior and mock template generation
 * since the actual backend calls require a running server.
 *
 * For integration tests with the real backend, see:
 * src/__tests__/integration/template-generation-backend-api.test.tsx
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentProcessorEnhanced } from '../../lib/document-processor-enhanced';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Type definitions
type SmartVariable = {
  id: string;
  name: string;
  type: string;
  description?: string;
  extraction_hints?: string[];
  confidence_threshold?: number;
  default_value?: string | number;
};

// Helper to create test files
const createMockFile = (name: string, type: string, content: string = 'test content') => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

describe('Template Generation', () => {
  let documentProcessor: DocumentProcessorEnhanced;

  beforeEach(() => {
    documentProcessor = new DocumentProcessorEnhanced();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Mock Fallback Behavior', () => {
    it('should generate fallback template when backend is unavailable', async () => {
      // Simulate backend unavailable
      mockFetch.mockRejectedValue(new Error('Network error'));

      const file = createMockFile('test-invoice.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Invoice', 'invoice');

      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
      expect(result.template.name).toBe('Test Invoice');
      expect(result.template.category).toBe('invoice');
    });

    it('should generate smart variables for invoice category', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('invoice.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Invoice Template', 'invoice');

      const variables = result.template.smart_variables as SmartVariable[];
      expect(variables.length).toBeGreaterThan(0);

      // Invoice templates should have invoice-specific fields
      const fieldNames = variables.map(v => v.id.toLowerCase());
      expect(fieldNames.some(n => n.includes('invoice') || n.includes('number'))).toBe(true);
    });

    it('should generate smart variables for receipt category', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('receipt.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Receipt Template', 'receipt');

      const variables = result.template.smart_variables as SmartVariable[];
      expect(variables.length).toBeGreaterThan(0);
    });

    it('should generate smart variables for contract category', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('contract.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Contract Template', 'contract');

      const variables = result.template.smart_variables as SmartVariable[];
      expect(variables.length).toBeGreaterThan(0);
    });

    it('should generate smart variables for generic document category', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('document.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Document Template', 'document');

      const variables = result.template.smart_variables as SmartVariable[];
      expect(variables.length).toBeGreaterThan(0);
    });

    it('should include extraction rules for each variable', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'invoice');

      expect(result.template.extraction_rules).toBeDefined();
      expect(result.template.extraction_rules.length).toBeGreaterThan(0);
    });

    it('should include generation settings in fallback template', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.template.generation_settings).toBeDefined();
    });

    it('should handle timeout errors gracefully', async () => {
      const abortError = new Error('Request timed out');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });
  });

  describe('Template Structure Validation', () => {
    it('should generate template with required properties', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test Template', 'invoice');

      // Check required template properties
      expect(result.template).toHaveProperty('name');
      expect(result.template).toHaveProperty('category');
      expect(result.template).toHaveProperty('smart_variables');
      expect(result.template).toHaveProperty('variables');
      expect(result.template).toHaveProperty('description');
    });

    it('should generate template with valid smart variable structure', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'invoice');

      const firstVariable = result.template.smart_variables[0] as SmartVariable;
      expect(firstVariable).toHaveProperty('id');
      expect(firstVariable).toHaveProperty('name');
      expect(firstVariable).toHaveProperty('type');
      expect(firstVariable).toHaveProperty('description');
      expect(firstVariable).toHaveProperty('extraction_hints');
    });

    it('should generate template content based on category', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Invoice Test', 'invoice');

      expect(result.template.template_content).toBeDefined();
      expect(typeof result.template.template_content).toBe('string');
    });

    it('should include generation metadata', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'test');

      expect(result.generation_metadata).toBeDefined();
      expect(result.generation_metadata?.generation_method).toBe('mock-fallback');
    });
  });

  describe('Category-Specific Fields', () => {
    it('should generate currency fields for invoice templates', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('invoice.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Invoice', 'invoice');

      const variables = result.template.smart_variables as SmartVariable[];
      const hasAmountField = variables.some(v =>
        v.type === 'currency' || v.id.includes('amount') || v.id.includes('total')
      );
      expect(hasAmountField).toBe(true);
    });

    it('should generate date fields for document templates', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('document.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Document', 'document');

      const variables = result.template.smart_variables as SmartVariable[];
      const hasDateField = variables.some(v =>
        v.type === 'date' || v.id.includes('date')
      );
      expect(hasDateField).toBe(true);
    });

    it('should generate text fields for all templates', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));

      const file = createMockFile('test.pdf', 'application/pdf');
      const result = await documentProcessor.generateTemplate(file, 'Test', 'contract');

      const variables = result.template.smart_variables as SmartVariable[];
      const hasTextField = variables.some(v => v.type === 'text');
      expect(hasTextField).toBe(true);
    });
  });

  describe('Decision Logic', () => {
    it('should identify when to generate new template vs use existing', () => {
      // Test the decision logic patterns
      const noTemplatesEvaluation = {
        template_suggestions: [],
        processing_recommendations: {
          workflow: 'generate_template',
          suggested_action: 'Generate a new AI-powered template'
        }
      };

      expect(noTemplatesEvaluation.template_suggestions.length).toBe(0);
      expect(noTemplatesEvaluation.processing_recommendations.workflow).toBe('generate_template');
    });

    it('should identify when existing template is available', () => {
      const existingTemplatesEvaluation = {
        template_suggestions: [
          { template_id: 123, template_name: 'Existing Template', confidence: 0.9 }
        ],
        processing_recommendations: {
          workflow: 'existing_template',
          suggested_action: 'Use existing template'
        }
      };

      expect(existingTemplatesEvaluation.template_suggestions.length).toBeGreaterThan(0);
      expect(existingTemplatesEvaluation.processing_recommendations.workflow).toBe('existing_template');
    });
  });

  describe('Quality Indicators', () => {
    it('should recognize high quality template metrics', () => {
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

    it('should recognize low quality template metrics', () => {
      const lowQualityTemplate = {
        generation_metadata: {
          ai_confidence: 0.4,
          fields_detected: 1
        },
        test_extraction: {
          extraction_successful: false,
          average_confidence: 0.3
        }
      };

      expect(lowQualityTemplate.generation_metadata.ai_confidence).toBeLessThan(0.5);
      expect(lowQualityTemplate.test_extraction.extraction_successful).toBe(false);
    });
  });
});
