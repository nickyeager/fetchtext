/**
 * Field Persistence Service
 *
 * Handles saving extracted fields to the database
 * Responsible for merging new fields with existing extracted data
 *
 * @module field-persistence-service
 */

import { supabase } from '@/lib/supabase';
import { requireAuthentication } from '@/lib/supabase-auth-utils';

export interface SaveFieldOptions {
  documentId: string;
  fieldName: string;
  value: unknown;
  confidence: number;
  sourceText?: string;
  location?: { page?: number; position?: number };
}

export interface ExtractedFieldData {
  value: unknown;
  confidence: number;
  sourceText?: string;
  location?: { page?: number; position?: number };
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
   * Merges the new field with existing extracted_fields in the document metadata
   * Preserves user edits and other fields
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

    // Fetch current document
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('metadata, extracted_fields')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Failed to fetch document: ${fetchError?.message || 'Not found'}`);
    }

    // Prepare field data
    const fieldData: ExtractedFieldData = {
      value,
      confidence,
      ...(sourceText && { sourceText }),
      ...(location && { location }),
      extracted_at: new Date().toISOString(),
      extraction_method: 'real_time_extraction',
    };

    // Merge with existing fields
    // Priority: metadata.extracted_fields > extracted_fields column
    const metadata = (document.metadata as Record<string, unknown>) || {};
    const metadataExtractedFields = metadata.extracted_fields as Record<string, unknown> || {};
    const columnExtractedFields = document.extracted_fields as Record<string, unknown> || {};

    // Start with column fields, overlay metadata fields, then add new field
    const mergedFields = {
      ...columnExtractedFields,
      ...metadataExtractedFields,
      [fieldName]: fieldData,
    };

    // Update both metadata and extracted_fields column for redundancy
    const updatedMetadata = {
      ...metadata,
      extracted_fields: mergedFields,
    };

    // Save to database
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        metadata: updatedMetadata,
        extracted_fields: mergedFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to save field: ${updateError.message}`);
    }

    // eslint-disable-next-line no-console
    console.log(`[FieldPersistenceService] Saved field "${fieldName}" for document ${documentId}`, {
      value,
      confidence,
      userId: user.id,
    });
  }

  /**
   * Save multiple fields at once (batch operation)
   *
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

    // Fetch current document
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('metadata, extracted_fields')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error(`Failed to fetch document: ${fetchError?.message || 'Not found'}`);
    }

    // Add metadata to each field
    const fieldsWithMetadata: Record<string, ExtractedFieldData> = {};
    Object.entries(fields).forEach(([name, data]) => {
      fieldsWithMetadata[name] = {
        ...data,
        extracted_at: new Date().toISOString(),
        extraction_method: 'real_time_extraction',
      };
    });

    // Merge with existing fields
    const metadata = (document.metadata as Record<string, unknown>) || {};
    const metadataExtractedFields = metadata.extracted_fields as Record<string, unknown> || {};
    const columnExtractedFields = document.extracted_fields as Record<string, unknown> || {};

    const mergedFields = {
      ...columnExtractedFields,
      ...metadataExtractedFields,
      ...fieldsWithMetadata,
    };

    // Update both locations
    const updatedMetadata = {
      ...metadata,
      extracted_fields: mergedFields,
    };

    // Save to database
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        metadata: updatedMetadata,
        extracted_fields: mergedFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to save fields: ${updateError.message}`);
    }

    // eslint-disable-next-line no-console
    console.log(`[FieldPersistenceService] Saved ${Object.keys(fields).length} fields for document ${documentId}`, {
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
