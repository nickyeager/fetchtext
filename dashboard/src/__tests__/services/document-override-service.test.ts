import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DocumentOverrideService,
  DocumentOverrides,
  FieldOverride,
} from '@/services/document-override-service'

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' },
          },
        },
        error: null,
      }),
    },
  },
}))

describe('DocumentOverrideService', () => {
  let service: DocumentOverrideService

  beforeEach(() => {
    service = new DocumentOverrideService()
    vi.clearAllMocks()
  })

  describe('saveFieldOverride', () => {
    it('should save a field override with user tracking', async () => {
      const documentId = 'doc-123'
      const fieldName = 'invoice_amount'
      const newValue = '$1,750.00'
      const originalValue = '$1,500.00'

      const result = await service.saveFieldOverride(
        documentId,
        fieldName,
        newValue,
        originalValue
      )

      expect(result).toBeDefined()
      expect(result.field_overrides?.[fieldName]).toBeDefined()
      expect(result.field_overrides?.[fieldName].value).toBe(newValue)
      expect(result.field_overrides?.[fieldName].original_value).toBe(originalValue)
      expect(result.field_overrides?.[fieldName].modified_by).toBe('test-user-id')
      expect(result.field_overrides?.[fieldName].modified_at).toBeDefined()
      expect(result.has_overrides).toBe(true)
    })

    it('should preserve existing overrides when adding new one', async () => {
      const documentId = 'doc-123'

      // First override
      await service.saveFieldOverride(documentId, 'field_a', 'value_a', 'orig_a')

      // Second override should preserve first
      const result = await service.saveFieldOverride(documentId, 'field_b', 'value_b', 'orig_b')

      expect(result.field_overrides?.['field_a']).toBeDefined()
      expect(result.field_overrides?.['field_b']).toBeDefined()
    })

    it('should track override reason as manual_edit by default', async () => {
      const result = await service.saveFieldOverride('doc-123', 'field', 'new', 'old')

      expect(result.field_overrides?.['field'].override_reason).toBe('manual_edit')
    })
  })

  describe('saveTemplateContentOverride', () => {
    it('should save template content override with source tracking', async () => {
      const documentId = 'doc-123'
      const newContent = 'Invoice #{{invoice_number}}\nNew line added'
      const originalContent = 'Invoice #{{invoice_number}}'
      const templateId = 42
      const templateVersion = '2024-01-15T10:00:00Z'

      const result = await service.saveTemplateContentOverride(
        documentId,
        newContent,
        originalContent,
        templateId,
        templateVersion
      )

      expect(result.template_content_override).toBeDefined()
      expect(result.template_content_override?.content).toBe(newContent)
      expect(result.template_content_override?.original_content).toBe(originalContent)
      expect(result.template_content_override?.source_template_id).toBe(templateId)
      expect(result.template_content_override?.source_template_version).toBe(templateVersion)
      expect(result.template_content_override?.modified_by).toBe('test-user-id')
      expect(result.has_overrides).toBe(true)
    })
  })

  describe('resetFieldOverride', () => {
    it('should remove a single field override', async () => {
      const documentId = 'doc-123'

      // Setup: save two overrides
      await service.saveFieldOverride(documentId, 'field_a', 'value_a', 'orig_a')
      await service.saveFieldOverride(documentId, 'field_b', 'value_b', 'orig_b')

      // Reset one
      const result = await service.resetFieldOverride(documentId, 'field_a')

      expect(result.field_overrides?.['field_a']).toBeUndefined()
      expect(result.field_overrides?.['field_b']).toBeDefined()
    })

    it('should set has_overrides to false when last override removed', async () => {
      const documentId = 'doc-123'

      await service.saveFieldOverride(documentId, 'only_field', 'value', 'orig')
      const result = await service.resetFieldOverride(documentId, 'only_field')

      expect(result.has_overrides).toBe(false)
      expect(result.field_overrides).toEqual({})
    })
  })

  describe('resetAllOverrides', () => {
    it('should clear all field and template overrides', async () => {
      const documentId = 'doc-123'

      // Setup: save multiple overrides
      await service.saveFieldOverride(documentId, 'field_a', 'value_a', 'orig_a')
      await service.saveFieldOverride(documentId, 'field_b', 'value_b', 'orig_b')
      await service.saveTemplateContentOverride(documentId, 'new', 'old', 1, 'v1')

      // Reset all
      const result = await service.resetAllOverrides(documentId)

      expect(result.has_overrides).toBe(false)
      expect(result.field_overrides).toEqual({})
      expect(result.template_content_override).toBeUndefined()
    })
  })

  describe('getOverrides', () => {
    it('should return null for document without overrides', async () => {
      const result = await service.getOverrides('doc-no-overrides')

      expect(result).toBeNull()
    })

    it('should return existing overrides', async () => {
      const documentId = 'doc-123'
      await service.saveFieldOverride(documentId, 'field', 'value', 'orig')

      const result = await service.getOverrides(documentId)

      expect(result).toBeDefined()
      expect(result?.has_overrides).toBe(true)
      expect(result?.field_overrides?.['field']).toBeDefined()
    })
  })

  describe('getEffectiveFieldValues', () => {
    it('should merge extracted fields with overrides', async () => {
      const documentId = 'doc-123'
      const extractedFields = {
        invoice_number: { value: 'INV-001', confidence: 0.95 },
        amount: { value: '$1,500.00', confidence: 0.87 },
        client_name: { value: 'John Smith', confidence: 0.92 },
      }

      // Override one field
      await service.saveFieldOverride(documentId, 'amount', '$1,750.00', '$1,500.00')

      const result = await service.getEffectiveFieldValues(documentId, extractedFields)

      // Non-overridden fields unchanged
      expect(result['invoice_number'].value).toBe('INV-001')
      expect(result['client_name'].value).toBe('John Smith')

      // Overridden field uses override value
      expect(result['amount'].value).toBe('$1,750.00')
      expect(result['amount'].isOverride).toBe(true)
      expect(result['amount'].originalValue).toBe('$1,500.00')
    })

    it('should preserve confidence from original extraction for overrides', async () => {
      const documentId = 'doc-123'
      const extractedFields = {
        amount: { value: '$1,500.00', confidence: 0.87 },
      }

      await service.saveFieldOverride(documentId, 'amount', '$1,750.00', '$1,500.00')
      const result = await service.getEffectiveFieldValues(documentId, extractedFields)

      expect(result['amount'].originalConfidence).toBe(0.87)
    })
  })

  describe('hasOverrides', () => {
    it('should return false for document without overrides', async () => {
      const result = await service.hasOverrides('doc-no-overrides')
      expect(result).toBe(false)
    })

    it('should return true for document with field overrides', async () => {
      const documentId = 'doc-123'
      await service.saveFieldOverride(documentId, 'field', 'value', 'orig')

      const result = await service.hasOverrides(documentId)
      expect(result).toBe(true)
    })

    it('should return true for document with template content override', async () => {
      const documentId = 'doc-123'
      await service.saveTemplateContentOverride(documentId, 'new', 'old', 1, 'v1')

      const result = await service.hasOverrides(documentId)
      expect(result).toBe(true)
    })
  })

  describe('conflict detection on re-extraction', () => {
    it('should detect when re-extracted value differs from override', async () => {
      const documentId = 'doc-123'

      // User overrode amount to $1,750
      await service.saveFieldOverride(documentId, 'amount', '$1,750.00', '$1,500.00')

      // Re-extraction returns different value
      const newExtractedFields = {
        amount: { value: '$1,600.00', confidence: 0.90 },
      }

      const conflicts = await service.detectOverrideConflicts(documentId, newExtractedFields)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].fieldName).toBe('amount')
      expect(conflicts[0].overrideValue).toBe('$1,750.00')
      expect(conflicts[0].newExtractedValue).toBe('$1,600.00')
      expect(conflicts[0].previousExtractedValue).toBe('$1,500.00')
    })

    it('should not flag conflict when re-extracted matches original', async () => {
      const documentId = 'doc-123'

      await service.saveFieldOverride(documentId, 'amount', '$1,750.00', '$1,500.00')

      // Re-extraction returns same as original
      const newExtractedFields = {
        amount: { value: '$1,500.00', confidence: 0.92 },
      }

      const conflicts = await service.detectOverrideConflicts(documentId, newExtractedFields)

      expect(conflicts).toHaveLength(0)
    })
  })
})
