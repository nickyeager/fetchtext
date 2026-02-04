/**
 * Field Extraction Hook
 *
 * Main hook for coordinating real-time field extraction
 * Manages state, notifications, and database persistence
 *
 * @module use-field-extraction
 */

import { useReducer, useCallback, useEffect } from 'react';
import { fieldExtractionReducer, isExtracting, canRetry } from '@/lib/field-extraction-state';
import { FieldPersistenceService } from '@/services/field-persistence-service';
import { useFieldNotifications } from './use-field-notifications';
import { API_ENDPOINTS } from '@/lib/api-config';
import type {
  FieldExtractionState,
  SmartVariable,
  ExtractedFieldUpdate,
} from '@/types/extraction';

export interface UseFieldExtractionOptions {
  /** Document ID for saving extracted fields (optional - if not provided, fields won't be persisted to database) */
  documentId?: string;
  /** Document text content for extraction */
  documentText?: string;
  /** Callback when field successfully extracted */
  onFieldExtracted?: (field: ExtractedFieldUpdate) => void;
  /** Callback when field extraction fails */
  onFieldFailed?: (fieldName: string, error: string) => void;
}

export interface UseFieldExtractionReturn {
  /** Extract a single field */
  extractField: (variable: SmartVariable) => Promise<void>;
  /** Retry a failed extraction */
  retryField: (fieldName: string) => Promise<void>;
  /** Current extraction states for all fields */
  fieldStates: Map<string, FieldExtractionState>;
  /** Check if a specific field is currently extracting */
  isExtracting: (fieldName: string) => boolean;
  /** Check if a failed field can be retried */
  canRetry: (fieldName: string) => boolean;
}

/**
 * Hook for managing field extraction lifecycle
 *
 * Coordinates extraction, state management, notifications, and persistence
 *
 * @example
 * const { extractField, fieldStates, isExtracting } = useFieldExtraction({
 *   documentId: 'doc-123',
 *   documentText: 'document content...',
 *   onFieldExtracted: (field) => {
 *     console.log('Extracted:', field.fieldName, field.value);
 *   },
 * });
 *
 * // Extract a field
 * await extractField({
 *   id: 'vendor_name',
 *   name: 'vendor_name',
 *   type: 'text',
 *   description: 'Name of the vendor',
 *   extraction_hints: ['vendor', 'company name'],
 * });
 */
export function useFieldExtraction(
  options: UseFieldExtractionOptions
): UseFieldExtractionReturn {
  const { documentId, documentText, onFieldExtracted, onFieldFailed } = options;

  // State management
  const [fieldStates, dispatch] = useReducer(
    fieldExtractionReducer,
    new Map<string, FieldExtractionState>()
  );

  // Notifications
  const notifications = useFieldNotifications();

  // Store variables for retry
  const variableCache = new Map<string, SmartVariable>();

  /**
   * Extract a single field from the document
   */
  const extractField = useCallback(
    async (variable: SmartVariable): Promise<void> => {
      const fieldName = variable.name;

      // Validation
      if (!documentText || documentText.length < 10) {
        notifications.notifyError(
          'Cannot extract field',
          'Document text is not available or too short'
        );
        return;
      }

      // Check if already extracting
      if (isExtracting(fieldStates, fieldName)) {
        notifications.notifyError(
          'Extraction in progress',
          `Already extracting ${fieldName}`
        );
        return;
      }

      // Cache variable for potential retry
      variableCache.set(fieldName, variable);

      // Show loading toast
      const toastId = notifications.notifyExtractionStart(fieldName);

      // Update state to extracting
      dispatch({
        type: 'EXTRACTION_START',
        fieldName,
        toastId,
      });

      try {
        // Call backend extraction API
        // Note: This uses the DocumentProcessorEnhanced which calls the backend
        // We create a minimal template with just this one variable
        const response = await fetch(API_ENDPOINTS.smartExtract, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text_content: documentText,
            template_data: {
              smart_variables: [variable],
            },
            confidence_threshold: 0.6,
          }),
        });

        if (!response.ok) {
          throw new Error(`Extraction failed: ${response.statusText}`);
        }

        const result = await response.json();
        const extractedData = result.extracted_data?.extracted_values?.[fieldName];
        const confidence = result.extracted_data?.confidence_scores?.[fieldName] || 0;

        if (!extractedData) {
          throw new Error('Field not found in extraction result');
        }

        const extractedValue = typeof extractedData === 'object' && 'value' in extractedData
          ? extractedData.value
          : extractedData;
        const sourceText = typeof extractedData === 'object' && 'sourceText' in extractedData
          ? extractedData.sourceText
          : undefined;
        const location = typeof extractedData === 'object' && 'location' in extractedData
          ? extractedData.location
          : undefined;

        // Update state to success
        dispatch({
          type: 'EXTRACTION_SUCCESS',
          fieldName,
          value: extractedValue,
          confidence,
        });

        // Show success toast
        notifications.notifyExtractionSuccess(toastId, fieldName, extractedValue);

        // Save to database (only if documentId is valid)
        if (documentId && documentId.trim() !== '') {
          try {
            await FieldPersistenceService.saveField({
              documentId,
              fieldName,
              value: extractedValue,
              confidence,
              sourceText,
              location,
            });
          } catch (saveError) {
            // eslint-disable-next-line no-console
            console.error('[useFieldExtraction] Failed to save field to database:', saveError);
            // Don't fail the extraction if save fails - user still sees the value
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn('[useFieldExtraction] Skipping database save - no valid documentId provided');
        }

        // Notify caller
        onFieldExtracted?.({
          fieldName,
          value: extractedValue,
          confidence,
          sourceText,
          location,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // eslint-disable-next-line no-console
        console.error('[useFieldExtraction] Extraction failed:', error);

        // Update state to failed
        dispatch({
          type: 'EXTRACTION_FAILED',
          fieldName,
          error: errorMessage,
          canRetry: true,
        });

        // Show error toast with retry button
        notifications.notifyExtractionFailed(
          toastId,
          fieldName,
          errorMessage,
          () => retryField(fieldName)
        );

        // Mark as failed in database (only if documentId is valid)
        if (documentId && documentId.trim() !== '') {
          try {
            await FieldPersistenceService.markFieldFailed(documentId, fieldName, errorMessage);
          } catch (markError) {
            // eslint-disable-next-line no-console
            console.error('[useFieldExtraction] Failed to mark field as failed:', markError);
          }
        }

        // Notify caller
        onFieldFailed?.(fieldName, errorMessage);
      }
    },
    [
      documentId,
      documentText,
      fieldStates,
      notifications,
      onFieldExtracted,
      onFieldFailed,
    ]
  );

  /**
   * Retry a failed extraction
   */
  const retryField = useCallback(
    async (fieldName: string): Promise<void> => {
      const variable = variableCache.get(fieldName);

      if (!variable) {
        notifications.notifyError(
          'Cannot retry',
          `Variable definition not found for ${fieldName}`
        );
        return;
      }

      if (!canRetry(fieldStates, fieldName)) {
        notifications.notifyError(
          'Cannot retry',
          `Field ${fieldName} is not in a retryable state`
        );
        return;
      }

      // Extract again
      await extractField(variable);
    },
    [fieldStates, notifications, extractField]
  );

  // Cleanup variable cache on unmount
  useEffect(() => {
    return () => {
      variableCache.clear();
    };
  }, []);

  return {
    extractField,
    retryField,
    fieldStates,
    isExtracting: (fieldName: string) => isExtracting(fieldStates, fieldName),
    canRetry: (fieldName: string) => canRetry(fieldStates, fieldName),
  };
}
