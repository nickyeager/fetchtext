/**
 * Tests for template validator
 */
import { describe, it, expect } from 'vitest';
import { TemplateValidator, Template } from '../template-validator';

describe('TemplateValidator', () => {
  const validator = new TemplateValidator();

  describe('Basic validation', () => {
    it('should pass validation for a valid template', () => {
      const template: Template = {
        name: 'Invoice Template',
        category: 'invoice',
        description: 'A template for processing invoices',
        smart_variables: [
          {
            id: 'invoice_number',
            name: 'Invoice Number',
            type: 'text',
            description: 'The unique invoice identifier',
            extraction_hints: ['invoice #', 'inv #', 'invoice number'],
            confidence_threshold: 0.8
          },
          {
            id: 'total_amount',
            name: 'Total Amount',
            type: 'currency',
            description: 'The total amount due',
            extraction_hints: ['total', 'amount due', 'total due'],
            confidence_threshold: 0.9,
            validation_rules: {
              required: true,
              min: 0
            }
          }
        ]
      };

      const result = validator.validate(template);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should fail validation for missing required fields', () => {
      const template = {
        name: 'Test Template'
        // Missing category and smart_variables
      };

      const result = validator.validate(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'category',
          code: 'REQUIRED_FIELD_MISSING'
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'smart_variables',
          code: 'REQUIRED_FIELD_MISSING'
        })
      );
    });

    it('should fail validation for empty smart variables', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: []
      };

      const result = validator.validate(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'smart_variables',
          code: 'NO_VARIABLES'
        })
      );
    });
  });

  describe('Smart variable validation', () => {
    it('should validate smart variable structure', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: [
          {
            id: 'test_field',
            name: 'Test Field',
            type: 'text',
            description: 'A test field',
            extraction_hints: ['test', 'field'],
            confidence_threshold: 0.5
          }
        ]
      };

      const result = validator.validate(template);
      expect(result.isValid).toBe(true);
    });

    it('should fail for invalid variable ID format', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: [
          {
            id: 'Invalid-ID!',
            name: 'Test Field',
            type: 'text',
            description: 'A test field',
            extraction_hints: ['test'],
            confidence_threshold: 0.5
          }
        ]
      };

      const result = validator.validate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'smart_variables[0].id',
          code: 'INVALID_VARIABLE_ID_FORMAT'
        })
      );
    });

    it('should fail for duplicate variable IDs', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: [
          {
            id: 'duplicate_id',
            name: 'Field 1',
            type: 'text',
            description: 'First field',
            extraction_hints: ['field1'],
            confidence_threshold: 0.5
          },
          {
            id: 'duplicate_id',
            name: 'Field 2',
            type: 'text',
            description: 'Second field',
            extraction_hints: ['field2'],
            confidence_threshold: 0.5
          }
        ]
      };

      const result = validator.validate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'smart_variables[1].id',
          code: 'DUPLICATE_VARIABLE_ID'
        })
      );
    });

    it('should warn for insufficient extraction hints', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: [
          {
            id: 'test_field',
            name: 'Test Field',
            type: 'text',
            description: 'A test field',
            extraction_hints: ['test'], // Only one hint
            confidence_threshold: 0.5
          }
        ]
      };

      const result = validator.validate(template);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'smart_variables[0].extraction_hints',
          code: 'INSUFFICIENT_EXTRACTION_HINTS'
        })
      );
    });

    it('should fail for invalid confidence threshold', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: [
          {
            id: 'test_field',
            name: 'Test Field',
            type: 'text',
            description: 'A test field',
            extraction_hints: ['test', 'field'],
            confidence_threshold: 1.5 // Invalid (> 1)
          }
        ]
      };

      const result = validator.validate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'smart_variables[0].confidence_threshold',
          code: 'INVALID_CONFIDENCE_THRESHOLD'
        })
      );
    });
  });

  describe('Category-specific validation', () => {
    it('should not enforce hardcoded fields for any category', () => {
      const template = {
        name: 'Invoice Template',
        category: 'invoice',
        smart_variables: [
          {
            id: 'custom_field',
            name: 'Custom Field',
            type: 'text',
            description: 'A custom field for this invoice',
            extraction_hints: ['field'],
            confidence_threshold: 0.5
          }
        ]
      };

      const result = validator.validate(template);
      // Should not have any errors about missing specific fields
      const categoryErrors = result.errors.filter(e => e.code === 'MISSING_CATEGORY_FIELDS');
      expect(categoryErrors).toHaveLength(0);
      
      // Template should be valid with any custom fields
      expect(result.isValid).toBe(true);
    });
  });

  describe('Auto-fix functionality', () => {
    it('should fix missing required fields', () => {
      const template = {
        smart_variables: [
          {
            name: 'Test Field',
            type: 'text',
            description: 'A test field'
          }
        ]
      };

      const fixed = validator.autoFix(template);
      
      expect(fixed.name).toBeTruthy();
      expect(fixed.category).toBeTruthy();
      expect(fixed.smart_variables[0].id).toBeTruthy();
      expect(fixed.smart_variables[0].extraction_hints).toHaveLength(1);
      expect(fixed.smart_variables[0].confidence_threshold).toBe(0.5);
    });

    it('should convert names to snake_case IDs', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: [
          {
            name: 'Invoice Number!',
            type: 'text',
            description: 'The invoice number'
          }
        ]
      };

      const fixed = validator.autoFix(template);
      expect(fixed.smart_variables[0].id).toBe('invoice_number');
    });

    it('should generate appropriate extraction hints by type', () => {
      const template = {
        name: 'Test Template',
        category: 'general',
        smart_variables: [
          {
            name: 'Email Address',
            type: 'email',
            description: 'Contact email'
          },
          {
            name: 'Phone Number',
            type: 'phone',
            description: 'Contact phone'
          },
          {
            name: 'Due Date',
            type: 'date',
            description: 'When payment is due'
          }
        ]
      };

      const fixed = validator.autoFix(template);
      
      // Email field should have email-specific hints
      expect(fixed.smart_variables[0].extraction_hints).toContain('email');
      
      // Phone field should have phone-specific hints
      expect(fixed.smart_variables[1].extraction_hints).toContain('phone');
      
      // Date field should have date-specific hints
      expect(fixed.smart_variables[2].extraction_hints).toContain('date');
    });
  });

  describe('Quality scoring', () => {
    it('should give high scores to well-structured templates', () => {
      const template: Template = {
        name: 'Professional Invoice Template',
        category: 'invoice',
        description: 'A comprehensive invoice processing template with all necessary fields',
        smart_variables: [
          {
            id: 'invoice_number',
            name: 'Invoice Number',
            type: 'text',
            description: 'Unique identifier for the invoice',
            extraction_hints: ['invoice #', 'inv #', 'invoice number', 'invoice id'],
            confidence_threshold: 0.8,
            validation_rules: { required: true }
          },
          {
            id: 'total_amount',
            name: 'Total Amount',
            type: 'currency',
            description: 'Total amount due including tax',
            extraction_hints: ['total', 'amount due', 'total due', 'final amount'],
            confidence_threshold: 0.9,
            validation_rules: { required: true, min: 0 }
          },
          {
            id: 'due_date',
            name: 'Due Date',
            type: 'date',
            description: 'When payment is due',
            extraction_hints: ['due date', 'payment due', 'due by'],
            confidence_threshold: 0.7
          }
        ]
      };

      const result = validator.validate(template);
      expect(result.score).toBeGreaterThan(90);
    });

    it('should give lower scores to problematic templates', () => {
      const template = {
        name: 'Bad',
        category: 'unknown_category',
        smart_variables: [
          {
            id: 'bad-id',
            name: 'X',
            type: 'text',
            description: 'Bad',
            extraction_hints: [],
            confidence_threshold: 1.5
          }
        ]
      };

      const result = validator.validate(template);
      expect(result.score).toBeLessThan(50);
    });
  });
});