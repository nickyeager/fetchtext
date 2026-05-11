import { supabase } from '@/lib/supabase'

/**
 * Types for document override management
 */

export interface FieldOverride {
  value: string | number | null
  original_value?: string | number | null
  original_confidence?: number
  override_reason?: 'manual_edit' | 'correction' | 'custom_value'
  modified_at: string
  modified_by: string
  modified_by_name?: string
  // Conflict detection
  has_conflict?: boolean
  conflict_new_value?: string | number | null
}

export interface TemplateContentOverride {
  content: string
  original_content: string
  source_template_id: number
  source_template_version: string
  modified_at: string
  modified_by: string
  modified_by_name?: string
}

export interface DocumentOverrides {
  has_overrides: boolean
  overrides_modified_at?: string
  overrides_modified_by?: string
  field_overrides?: Record<string, FieldOverride>
  template_content_override?: TemplateContentOverride
}

export interface ExtractedField {
  value: string | null
  confidence?: number
  sourceText?: string
  type?: string
}

export interface EffectiveField extends ExtractedField {
  isOverride?: boolean
  originalValue?: string | number | null
  originalConfidence?: number
}

export interface OverrideConflict {
  fieldName: string
  overrideValue: string | number | null
  newExtractedValue: string | number | null
  previousExtractedValue: string | number | null
}

/**
 * Service for managing document-level overrides
 * Allows users to modify extracted field values and template content
 * for individual documents without affecting global templates
 */
export class DocumentOverrideService {
  // In-memory cache for testing (in real impl, this comes from Supabase)
  private documentOverrides: Map<string, DocumentOverrides> = new Map()

  /**
   * Get the current user info for tracking modifications
   */
  private async getCurrentUser(): Promise<{ id: string; name: string }> {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    return {
      id: user?.id || 'anonymous',
      name:
        user?.user_metadata?.full_name ||
        user?.email ||
        'Anonymous User',
    }
  }

  /**
   * Get document overrides from dedicated columns in Supabase
   */
  private async getDocumentOverridesFromDB(
    documentId: string
  ): Promise<DocumentOverrides | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('field_overrides, template_content_override, overrides_modified_at, overrides_modified_by')
      .eq('id', documentId)
      .single()

    if (error || !data) {
      console.error('[DocumentOverrideService] Failed to fetch overrides:', error)
      return null
    }

    const hasOverrides = data.field_overrides !== null || data.template_content_override !== null

    if (!hasOverrides) {
      return null
    }

    return {
      has_overrides: hasOverrides,
      overrides_modified_at: data.overrides_modified_at,
      overrides_modified_by: data.overrides_modified_by,
      field_overrides: data.field_overrides as Record<string, FieldOverride> | undefined,
      template_content_override: data.template_content_override ? JSON.parse(data.template_content_override) : undefined,
    }
  }

  /**
   * Update document overrides in dedicated columns
   */
  private async updateDocumentOverridesInDB(
    documentId: string,
    overrides: DocumentOverrides
  ): Promise<void> {
    const user = await this.getCurrentUser()

    const { error } = await supabase
      .from('documents')
      .update({
        field_overrides: overrides.field_overrides || null,
        template_content_override: overrides.template_content_override
          ? JSON.stringify(overrides.template_content_override)
          : null,
        overrides_modified_at: new Date().toISOString(),
        overrides_modified_by: user.id,
      })
      .eq('id', documentId)

    if (error) {
      console.error('[DocumentOverrideService] Failed to update overrides:', error)
      throw error
    }

    // Update local cache
    this.documentOverrides.set(documentId, overrides)
  }

  /**
   * Save a field override
   */
  async saveFieldOverride(
    documentId: string,
    fieldName: string,
    newValue: string | number | null,
    originalValue?: string | number | null,
    originalConfidence?: number,
    overrideReason: 'manual_edit' | 'correction' | 'custom_value' = 'manual_edit'
  ): Promise<DocumentOverrides> {
    const user = await this.getCurrentUser()
    const now = new Date().toISOString()

    // Get existing overrides
    const existing = await this.getOverrides(documentId)
    const fieldOverrides = existing?.field_overrides || {}

    // Create new field override
    const newFieldOverride: FieldOverride = {
      value: newValue,
      original_value: originalValue,
      original_confidence: originalConfidence,
      override_reason: overrideReason,
      modified_at: now,
      modified_by: user.id,
      modified_by_name: user.name,
    }

    // Merge with existing
    const updatedOverrides: DocumentOverrides = {
      has_overrides: true,
      overrides_modified_at: now,
      overrides_modified_by: user.id,
      field_overrides: {
        ...fieldOverrides,
        [fieldName]: newFieldOverride,
      },
      template_content_override: existing?.template_content_override,
    }

    await this.updateDocumentOverridesInDB(documentId, updatedOverrides)
    return updatedOverrides
  }

  /**
   * Save template content override
   */
  async saveTemplateContentOverride(
    documentId: string,
    newContent: string,
    originalContent: string,
    templateId: number,
    templateVersion: string
  ): Promise<DocumentOverrides> {
    const user = await this.getCurrentUser()
    const now = new Date().toISOString()

    const existing = await this.getOverrides(documentId)

    const templateOverride: TemplateContentOverride = {
      content: newContent,
      original_content: originalContent,
      source_template_id: templateId,
      source_template_version: templateVersion,
      modified_at: now,
      modified_by: user.id,
      modified_by_name: user.name,
    }

    const updatedOverrides: DocumentOverrides = {
      has_overrides: true,
      overrides_modified_at: now,
      overrides_modified_by: user.id,
      field_overrides: existing?.field_overrides || {},
      template_content_override: templateOverride,
    }

    await this.updateDocumentOverridesInDB(documentId, updatedOverrides)
    return updatedOverrides
  }

  /**
   * Reset a single field override
   */
  async resetFieldOverride(
    documentId: string,
    fieldName: string
  ): Promise<DocumentOverrides> {
    const existing = await this.getOverrides(documentId)
    if (!existing) {
      return {
        has_overrides: false,
        field_overrides: {},
      }
    }

    const { [fieldName]: _, ...remainingFields } = existing.field_overrides || {}

    const hasRemainingOverrides =
      Object.keys(remainingFields).length > 0 ||
      existing.template_content_override !== undefined

    const updatedOverrides: DocumentOverrides = {
      has_overrides: hasRemainingOverrides,
      overrides_modified_at: existing.overrides_modified_at,
      overrides_modified_by: existing.overrides_modified_by,
      field_overrides: remainingFields,
      template_content_override: existing.template_content_override,
    }

    await this.updateDocumentOverridesInDB(documentId, updatedOverrides)
    return updatedOverrides
  }

  /**
   * Reset all overrides for a document
   */
  async resetAllOverrides(documentId: string): Promise<DocumentOverrides> {
    const clearedOverrides: DocumentOverrides = {
      has_overrides: false,
      field_overrides: {},
      template_content_override: undefined,
    }

    await this.updateDocumentOverridesInDB(documentId, clearedOverrides)
    return clearedOverrides
  }

  /**
   * Get overrides for a document
   */
  async getOverrides(documentId: string): Promise<DocumentOverrides | null> {
    // Check cache first
    if (this.documentOverrides.has(documentId)) {
      const cached = this.documentOverrides.get(documentId)!
      if (!cached.has_overrides) return null
      return cached
    }

    // Fetch from database using dedicated columns
    const overrides = await this.getDocumentOverridesFromDB(documentId)
    if (!overrides) {
      return null
    }

    this.documentOverrides.set(documentId, overrides)
    return overrides
  }

  /**
   * Check if document has any overrides
   */
  async hasOverrides(documentId: string): Promise<boolean> {
    const overrides = await this.getOverrides(documentId)
    return overrides?.has_overrides ?? false
  }

  /**
   * Get effective field values (extracted merged with overrides)
   */
  async getEffectiveFieldValues(
    documentId: string,
    extractedFields: Record<string, ExtractedField>
  ): Promise<Record<string, EffectiveField>> {
    const overrides = await this.getOverrides(documentId)
    const result: Record<string, EffectiveField> = {}

    for (const [fieldName, field] of Object.entries(extractedFields)) {
      const override = overrides?.field_overrides?.[fieldName]

      if (override) {
        // Field has override - use override value
        result[fieldName] = {
          value: override.value as string | null,
          confidence: field.confidence,
          sourceText: field.sourceText,
          type: field.type,
          isOverride: true,
          originalValue: override.original_value,
          originalConfidence: override.original_confidence ?? field.confidence,
        }
      } else {
        // No override - use extracted value
        result[fieldName] = {
          ...field,
          isOverride: false,
        }
      }
    }

    return result
  }

  /**
   * Detect conflicts between overrides and re-extracted values
   */
  async detectOverrideConflicts(
    documentId: string,
    newExtractedFields: Record<string, ExtractedField>
  ): Promise<OverrideConflict[]> {
    const overrides = await this.getOverrides(documentId)
    if (!overrides?.field_overrides) {
      return []
    }

    const conflicts: OverrideConflict[] = []

    for (const [fieldName, override] of Object.entries(overrides.field_overrides)) {
      const newField = newExtractedFields[fieldName]
      if (!newField) continue

      // Check if new extracted value differs from both override and original
      const newValue = newField.value
      const overrideValue = override.value
      const previousValue = override.original_value

      // Conflict exists if new extraction differs from original
      // (which means the document or extraction changed)
      if (newValue !== previousValue) {
        conflicts.push({
          fieldName,
          overrideValue,
          newExtractedValue: newValue,
          previousExtractedValue: previousValue ?? null,
        })
      }
    }

    return conflicts
  }

  /**
   * Get the count of overrides for a document
   */
  async getOverrideCount(documentId: string): Promise<{
    total: number
    fieldCount: number
    hasTemplateOverride: boolean
  }> {
    const overrides = await this.getOverrides(documentId)
    if (!overrides) {
      return { total: 0, fieldCount: 0, hasTemplateOverride: false }
    }

    const fieldCount = Object.keys(overrides.field_overrides || {}).length
    const hasTemplateOverride = overrides.template_content_override !== undefined

    return {
      total: fieldCount + (hasTemplateOverride ? 1 : 0),
      fieldCount,
      hasTemplateOverride,
    }
  }
}

// Singleton instance
export const documentOverrideService = new DocumentOverrideService()
