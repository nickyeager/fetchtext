/**
 * Field Persistence Service
 *
 * Handles saving extracted fields to the database
 * Uses the canonical path: metadata.extracted_values
 *
 * @module field-persistence-service
 */

import { supabase } from '@/lib/supabase';
import { requireAuthentication } from '@/lib/supabase-auth-utils';
import {
  createMetadataWithExtractedFields,
  type ExtractedFieldValue,
  type ExtractedFieldsMap,
} from '@/lib/extracted-fields-utils';

export interface SaveFieldOptions {
  documentId: string;
  fieldName: string;
  value: unknown;
  confidence: number;
  sourceText?: string;
  location?: {
    page?: number;
    position?: number;
    bbox?: { x: number; y: number; width: number; height: number };
  };
}

export interface ExtractedFieldData {
  value: unknown;
  confidence: number;
  sourceText?: string;
  location?: {
    page?: number;
    position?: number;
    bbox?: { x: number; y: number; width: number; height: number };
  };
  extracted_at?: string;
  extraction_method?: string;
}

/**
 * Service for persisting extracted fields to the database
 */
export class FieldPersistenceService {
  /**
   * Save a single extracted field to the document
   *
   * Uses canonical path: metadata.extracted_values
   * Reads from all legacy paths for backwards compatibility
   *
   * @param options - Field data to save
   * @throws Error if save fails or authentication fails
   */
  static async saveField(options: SaveFieldOptions): Promise<void> {
    const {
      documentId,
      fieldName,
      value,
      confidence,
      sourceText,
      location,
    } = options;

    // Require authentication
    const user = await requireAuthentication();

    // Fetch current document metadata
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('metadata')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Failed to fetch document: ${fetchError?.message || 'Not found'}`);
    }

    // Prepare field data in canonical format
    const fieldData: ExtractedFieldValue = {
      value: value as string | number | null,
      confidence,
      sourceText,
      location,
    };

    // Create new field to add
    const newFields: ExtractedFieldsMap = {
      [fieldName]: fieldData,
    };

    // Use utility to merge with existing fields and write to canonical path
    const existingMetadata = (document.metadata as Record<string, unknown>) || {};
    const updatedMetadata = createMetadataWithExtractedFields(existingMetadata, newFields);

    // Save to database (only metadata column - no extracted_fields column exists)
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to save field: ${updateError.message}`);
    }

    // eslint-disable-next-line no-console
    console.log(`[FieldPersistenceService] Saved field "${fieldName}" to canonical path for document ${documentId}`, {
      value,
      confidence,
      userId: user.id,
    });
  }

  /**
   * Save multiple fields at once (batch operation)
   *
   * Uses canonical path: metadata.extracted_values
   * More efficient than calling saveField multiple times
   *
   * @param documentId - Document ID
   * @param fields - Record of field names to field data
   * @throws Error if save fails or authentication fails
   */
  static async saveFields(
    documentId: string,
    fields: Record<string, ExtractedFieldData>
  ): Promise<void> {
    // Require authentication
    const user = await requireAuthentication();

    // Fetch current document metadata
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('metadata')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Failed to fetch document: ${fetchError?.message || 'Not found'}`);
    }

    // Convert to canonical ExtractedFieldsMap format
    const newFields: ExtractedFieldsMap = {};
    Object.entries(fields).forEach(([name, data]) => {
      newFields[name] = {
        value: data.value as string | number | null,
        confidence: data.confidence,
        sourceText: data.sourceText,
        location: data.location,
      };
    });

    // Use utility to merge with existing fields and write to canonical path
    const existingMetadata = (document.metadata as Record<string, unknown>) || {};
    const updatedMetadata = createMetadataWithExtractedFields(existingMetadata, newFields);

    // Save to database (only metadata column)
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to save fields: ${updateError.message}`);
    }

    // eslint-disable-next-line no-console
    console.log(`[FieldPersistenceService] Saved ${Object.keys(fields).length} fields to canonical path for document ${documentId}`, {
      fieldNames: Object.keys(fields),
      userId: user.id,
    });
  }

  /**
   * Mark a field as having failed extraction
   *
   * Useful for tracking which fields couldn't be extracted automatically
   *
   * @param documentId - Document ID
   * @param fieldName - Name of field that failed
   * @param error - Error message
   * @throws Error if save fails or authentication fails
   */
  static async markFieldFailed(
    documentId: string,
    fieldName: string,
    error: string
  ): Promise<void> {
    // Require authentication
    await requireAuthentication();

    // Fetch current document
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('metadata')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Failed to fetch document: ${fetchError?.message || 'Not found'}`);
    }

    // Track failed extractions in metadata
    const metadata = (document.metadata as Record<string, unknown>) || {};
    const failedExtractions = (metadata.failed_extractions as Record<string, unknown>) || {};

    failedExtractions[fieldName] = {
      error,
      failed_at: new Date().toISOString(),
      can_retry: true,
    };

    const updatedMetadata = {
      ...metadata,
      failed_extractions: failedExtractions,
    };

    // Save to database
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to mark field as failed: ${updateError.message}`);
    }

    // eslint-disable-next-line no-console
    console.log(`[FieldPersistenceService] Marked field "${fieldName}" as failed for document ${documentId}`, {
      error,
    });
  }
}

// Export singleton instance
export const fieldPersistenceService = new FieldPersistenceService();
