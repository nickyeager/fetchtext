/**
 * Pure state management for field extraction lifecycle
 *
 * This module provides type-safe state transitions for real-time field extraction.
 * All functions are pure (no side effects) making them easy to test and reason about.
 *
 * @module field-extraction-state
 */

import type { FieldExtractionState, FieldExtractionAction } from '@/types/extraction';

/**
 * State reducer for field extraction
 * Handles all state transitions using a discriminated union pattern
 *
 * @param state - Current extraction state map
 * @param action - Action describing the state change
 * @returns New immutable state map
 */
export function fieldExtractionReducer(
  state: Map<string, FieldExtractionState>,
  action: FieldExtractionAction
): Map<string, FieldExtractionState> {
  const newState = new Map(state);

  switch (action.type) {
    case 'EXTRACTION_START':
      newState.set(action.fieldName, {
        status: 'extracting',
        progress: 0,
        toastId: action.toastId,
      });
      break;

    case 'EXTRACTION_PROGRESS':
      {
        const current = newState.get(action.fieldName);
        if (current?.status === 'extracting') {
          newState.set(action.fieldName, {
            ...current,
            progress: Math.min(100, Math.max(0, action.progress)),
          });
        }
      }
      break;

    case 'EXTRACTION_SUCCESS':
      {
        const current = newState.get(action.fieldName);
        newState.set(action.fieldName, {
          status: 'success',
          value: action.value,
          confidence: action.confidence,
          toastId: current?.status === 'extracting' ? current.toastId : undefined,
        });
      }
      break;

    case 'EXTRACTION_FAILED':
      {
        const current = newState.get(action.fieldName);
        newState.set(action.fieldName, {
          status: 'failed',
          error: action.error,
          canRetry: action.canRetry,
          toastId: current?.status === 'extracting' ? current.toastId : undefined,
        });
      }
      break;

    default:
      // TypeScript ensures all action types are handled
      return state;
  }

  return newState;
}

/**
 * Check if a field is currently being extracted
 *
 * @param state - Current state map
 * @param fieldName - Name of the field to check
 * @returns True if field is in 'extracting' status
 */
export function isExtracting(
  state: Map<string, FieldExtractionState>,
  fieldName: string
): boolean {
  const fieldState = state.get(fieldName);
  return fieldState?.status === 'extracting';
}

/**
 * Check if a failed extraction can be retried
 *
 * @param state - Current state map
 * @param fieldName - Name of the field to check
 * @returns True if field is in 'failed' status and can be retried
 */
export function canRetry(
  state: Map<string, FieldExtractionState>,
  fieldName: string
): boolean {
  const fieldState = state.get(fieldName);
  return fieldState?.status === 'failed' && fieldState.canRetry;
}

/**
 * Get the extracted value for a successfully extracted field
 *
 * @param state - Current state map
 * @param fieldName - Name of the field
 * @returns The extracted value, or null if not successfully extracted
 */
export function getFieldValue(
  state: Map<string, FieldExtractionState>,
  fieldName: string
): unknown | null {
  const fieldState = state.get(fieldName);
  if (fieldState?.status === 'success') {
    return fieldState.value;
  }
  return null;
}

/**
 * Get the confidence score for a successfully extracted field
 *
 * @param state - Current state map
 * @param fieldName - Name of the field
 * @returns Confidence score (0-1), or null if not successfully extracted
 */
export function getFieldConfidence(
  state: Map<string, FieldExtractionState>,
  fieldName: string
): number | null {
  const fieldState = state.get(fieldName);
  if (fieldState?.status === 'success') {
    return fieldState.confidence;
  }
  return null;
}

/**
 * Get the error message for a failed extraction
 *
 * @param state - Current state map
 * @param fieldName - Name of the field
 * @returns Error message, or null if not failed
 */
export function getFieldError(
  state: Map<string, FieldExtractionState>,
  fieldName: string
): string | null {
  const fieldState = state.get(fieldName);
  if (fieldState?.status === 'failed') {
    return fieldState.error;
  }
  return null;
}

/**
 * Get extraction progress percentage
 *
 * @param state - Current state map
 * @param fieldName - Name of the field
 * @returns Progress (0-100), or null if not extracting
 */
export function getExtractionProgress(
  state: Map<string, FieldExtractionState>,
  fieldName: string
): number | null {
  const fieldState = state.get(fieldName);
  if (fieldState?.status === 'extracting') {
    return fieldState.progress;
  }
  return null;
}

/**
 * Get all fields currently being extracted
 *
 * @param state - Current state map
 * @returns Array of field names with 'extracting' status
 */
export function getExtractingFields(
  state: Map<string, FieldExtractionState>
): string[] {
  const extracting: string[] = [];
  state.forEach((fieldState, fieldName) => {
    if (fieldState.status === 'extracting') {
      extracting.push(fieldName);
    }
  });
  return extracting;
}

/**
 * Get all successfully extracted fields with their values
 *
 * @param state - Current state map
 * @returns Record of field names to their values and confidence scores
 */
export function getExtractedFields(
  state: Map<string, FieldExtractionState>
): Record<string, { value: unknown; confidence: number }> {
  const extracted: Record<string, { value: unknown; confidence: number }> = {};
  state.forEach((fieldState, fieldName) => {
    if (fieldState.status === 'success') {
      extracted[fieldName] = {
        value: fieldState.value,
        confidence: fieldState.confidence,
      };
    }
  });
  return extracted;
}
