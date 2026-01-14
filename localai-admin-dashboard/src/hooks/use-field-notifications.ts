/**
 * Field Notifications Hook
 *
 * Manages toast notifications for field extraction lifecycle
 * Handles loading → success/error toast transitions with rich formatting
 *
 * @module use-field-notifications
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Format a field name for display
 * Converts snake_case to Title Case
 *
 * @example
 * formatFieldName('vendor_name') // => 'Vendor Name'
 * formatFieldName('total_amount') // => 'Total Amount'
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate and format a value for display in toast
 *
 * @param value - The value to format
 * @param maxLength - Maximum length before truncation
 * @returns Formatted string suitable for toast display
 */
function formatValue(value: unknown, maxLength: number = 60): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }

  let stringValue = String(value);

  // Special formatting for numbers
  if (typeof value === 'number') {
    // Format currency
    if (stringValue.includes('$') || stringValue.includes('USD')) {
      return stringValue;
    }
    // Format large numbers with commas
    if (value > 999) {
      return value.toLocaleString();
    }
  }

  // Truncate if too long
  if (stringValue.length > maxLength) {
    return stringValue.substring(0, maxLength) + '...';
  }

  return stringValue;
}

/**
 * Hook for managing field extraction toast notifications
 *
 * Provides a consistent API for showing loading, success, and error toasts
 * with automatic formatting and rich descriptions
 *
 * @example
 * const notifications = useFieldNotifications();
 *
 * const toastId = notifications.notifyExtractionStart('vendor_name');
 * // ... extraction happens ...
 * notifications.notifyExtractionSuccess(toastId, 'vendor_name', 'Acme Corp');
 */
export function useFieldNotifications() {
  /**
   * Show a loading toast when extraction starts
   *
   * @param fieldName - Name of the field being extracted
   * @returns Toast ID for updating the toast later
   */
  const notifyExtractionStart = useCallback((fieldName: string): string | number => {
    const formattedName = formatFieldName(fieldName);

    return toast.loading(`Extracting ${formattedName}...`, {
      description: 'Using AI to find this field in your document',
    });
  }, []);

  /**
   * Update toast to show successful extraction
   *
   * @param toastId - Toast ID from notifyExtractionStart
   * @param fieldName - Name of the extracted field
   * @param value - Extracted value
   */
  const notifyExtractionSuccess = useCallback(
    (toastId: string | number, fieldName: string, value: unknown): void => {
      const formattedName = formatFieldName(fieldName);
      const formattedValue = formatValue(value);

      toast.success(`${formattedName} extracted successfully!`, {
        id: toastId,
        description: `Value: ${formattedValue}`,
        duration: 3000,
      });
    },
    []
  );

  /**
   * Update toast to show extraction failure
   *
   * @param toastId - Toast ID from notifyExtractionStart
   * @param fieldName - Name of the field that failed
   * @param error - Error message
   * @param onRetry - Optional retry callback
   */
  const notifyExtractionFailed = useCallback(
    (
      toastId: string | number,
      fieldName: string,
      error: string,
      onRetry?: () => void
    ): void => {
      const formattedName = formatFieldName(fieldName);

      toast.error(`Failed to extract ${formattedName}`, {
        id: toastId,
        description: error,
        action: onRetry
          ? {
              label: 'Retry',
              onClick: onRetry,
            }
          : undefined,
        duration: 5000,
      });
    },
    []
  );

  /**
   * Show a simple success toast (not updating an existing toast)
   *
   * Useful for quick confirmations without the loading state
   */
  const notifySuccess = useCallback((message: string, description?: string): void => {
    toast.success(message, {
      description,
      duration: 3000,
    });
  }, []);

  /**
   * Show a simple error toast (not updating an existing toast)
   *
   * Useful for validation errors before extraction starts
   */
  const notifyError = useCallback((message: string, description?: string): void => {
    toast.error(message, {
      description,
      duration: 4000,
    });
  }, []);

  return {
    notifyExtractionStart,
    notifyExtractionSuccess,
    notifyExtractionFailed,
    notifySuccess,
    notifyError,
  };
}
