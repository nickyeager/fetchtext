/**
 * Extracted Fields Utility
 *
 * Consolidates all extracted field handling into ONE canonical location.
 *
 * CANONICAL PATH: metadata.extracted_values
 *
 * This utility handles backwards compatibility by reading from all legacy paths:
 * - metadata.extracted_data.extracted_values (legacy)
 * - metadata.extraction_result.extracted_values (legacy)
 * - metadata.extracted_fields (legacy)
 *
 * But ONLY writes to the canonical path: metadata.extracted_values
 *
 * @module extracted-fields-utils
 */

import type { DocumentRecord } from '@/services/unified-document-service';

/**
 * Standard structure for an extracted field value
 */
export interface ExtractedFieldValue {
  value: string | number | null;
  confidence?: number;
  sourceText?: string;
  location?: {
    page?: number;
    position?: number;
    bbox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

/**
 * Map of field names to their extracted values
 */
export type ExtractedFieldsMap = Record<string, ExtractedFieldValue>;

/**
 * Normalize a raw field value to the standard structure
 */
function normalizeFieldValue(value: unknown): ExtractedFieldValue {
  if (value === null || value === undefined) {
    return { value: null };
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return { value };
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // Already in the right format
    if ('value' in obj) {
      return {
        value: obj.value as string | number | null,
        confidence: obj.confidence as number | undefined,
        sourceText: obj.sourceText as string | undefined,
        location: obj.location as ExtractedFieldValue['location'],
      };
    }

    // Try to extract a meaningful value from the object
    return { value: JSON.stringify(value) };
  }

  return { value: String(value) };
}

/**
 * Get extracted fields from a document, checking all legacy paths
 *
 * Priority order (first non-empty wins):
 * 1. metadata.extracted_values (canonical)
 * 2. metadata.extraction_result.extracted_values
 * 3. metadata.extracted_fields
 * 4. metadata.extracted_data.extracted_values
 *
 * @param document - The document record
 * @returns Normalized extracted fields map
 */
export function getExtractedFields(
  document: DocumentRecord | null | undefined
): ExtractedFieldsMap {
  if (!document?.metadata) {
    return {};
  }

  const metadata = document.metadata as Record<string, unknown>;
  const result: ExtractedFieldsMap = {};

  // Define all paths to check, in priority order
  const paths: Array<{ name: string; data: Record<string, unknown> | undefined }> = [
    // Canonical path - highest priority
    {
      name: 'metadata.extracted_values',
      data: metadata.extracted_values as Record<string, unknown> | undefined,
    },
    // Legacy paths
    {
      name: 'metadata.extraction_result.extracted_values',
      data: (metadata.extraction_result as Record<string, unknown> | undefined)
        ?.extracted_values as Record<string, unknown> | undefined,
    },
    {
      name: 'metadata.extracted_fields',
      data: (() => {
        const raw = metadata.extracted_fields as Record<string, unknown> | undefined;
        if (raw && 'extracted_values' in raw && typeof raw.extracted_values === 'object') {
          return raw.extracted_values as Record<string, unknown>;
        }
        return raw;
      })(),
    },
    {
      name: 'metadata.extracted_data.extracted_values',
      data: (metadata.extracted_data as Record<string, unknown> | undefined)
        ?.extracted_values as Record<string, unknown> | undefined,
    },
  ];

  // Merge all paths, with earlier paths taking priority
  for (const { data } of paths) {
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        // Only add if not already present (priority order)
        if (!(key in result)) {
          result[key] = normalizeFieldValue(value);
        }
      }
    }
  }

  return result;
}

/**
 * Check if a document has any extracted fields
 */
export function hasExtractedFields(
  document: DocumentRecord | null | undefined
): boolean {
  const fields = getExtractedFields(document);
  return Object.keys(fields).length > 0;
}

/**
 * Get the count of extracted fields with non-null values
 */
export function getFilledFieldCount(
  document: DocumentRecord | null | undefined
): number {
  const fields = getExtractedFields(document);
  return Object.values(fields).filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== ''
  ).length;
}

/**
 * Create metadata update object with extracted fields in the canonical location
 *
 * Use this when updating document metadata to ensure fields are stored
 * in the canonical location (metadata.extracted_values)
 *
 * @param existingMetadata - Current document metadata
 * @param newFields - New fields to merge
 * @returns Metadata object ready for database update
 */
export function createMetadataWithExtractedFields(
  existingMetadata: Record<string, unknown> | undefined,
  newFields: ExtractedFieldsMap
): Record<string, unknown> {
  // Get existing fields from all legacy paths
  const existingFields = getExtractedFieldsFromMetadata(existingMetadata);

  // Merge with new fields (new fields take priority)
  const mergedFields: ExtractedFieldsMap = {
    ...existingFields,
    ...newFields,
  };

  return {
    ...existingMetadata,
    // Write ONLY to canonical path
    extracted_values: mergedFields,
    // Update timestamp
    fields_updated_at: new Date().toISOString(),
  };
}

/**
 * Get extracted fields directly from metadata object (without document wrapper)
 */
export function getExtractedFieldsFromMetadata(
  metadata: Record<string, unknown> | undefined
): ExtractedFieldsMap {
  if (!metadata) {
    return {};
  }

  const result: ExtractedFieldsMap = {};

  const paths: Array<Record<string, unknown> | undefined> = [
    metadata.extracted_values as Record<string, unknown> | undefined,
    (metadata.extraction_result as Record<string, unknown> | undefined)
      ?.extracted_values as Record<string, unknown> | undefined,
    metadata.extracted_fields as Record<string, unknown> | undefined,
    (metadata.extracted_data as Record<string, unknown> | undefined)
      ?.extracted_values as Record<string, unknown> | undefined,
  ];

  for (const data of paths) {
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (!(key in result)) {
          result[key] = normalizeFieldValue(value);
        }
      }
    }
  }

  return result;
}

/**
 * Get a single field value from a document
 */
export function getFieldValue(
  document: DocumentRecord | null | undefined,
  fieldName: string
): ExtractedFieldValue | null {
  const fields = getExtractedFields(document);
  return fields[fieldName] || null;
}

/**
 * Convert extracted fields map to a simple key-value record
 * Useful for display or export
 */
export function getSimpleFieldValues(
  document: DocumentRecord | null | undefined
): Record<string, string | number | null> {
  const fields = getExtractedFields(document);
  const result: Record<string, string | number | null> = {};

  for (const [key, field] of Object.entries(fields)) {
    result[key] = field.value;
  }

  return result;
}

/**
 * Debug utility: Log all paths where extracted fields are found
 */
export function debugExtractedFieldPaths(
  document: DocumentRecord | null | undefined
): void {
  if (!document?.metadata) {
    // eslint-disable-next-line no-console
    console.log('[ExtractedFields] No document or metadata');
    return;
  }

  const metadata = document.metadata as Record<string, unknown>;

  const paths = [
    {
      name: 'metadata.extracted_values (CANONICAL)',
      data: metadata.extracted_values,
    },
    {
      name: 'metadata.extraction_result.extracted_values',
      data: (metadata.extraction_result as Record<string, unknown> | undefined)?.extracted_values,
    },
    {
      name: 'metadata.extracted_fields',
      data: metadata.extracted_fields,
    },
    {
      name: 'metadata.extracted_data.extracted_values',
      data: (metadata.extracted_data as Record<string, unknown> | undefined)?.extracted_values,
    },
  ];

  // eslint-disable-next-line no-console
  console.log('[ExtractedFields] Checking all paths:');
  for (const { name, data } of paths) {
    const count = data && typeof data === 'object' ? Object.keys(data).length : 0;
    // eslint-disable-next-line no-console
    console.log(`  ${name}: ${count} fields`);
  }
}
