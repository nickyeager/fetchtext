/**
 * Shared Document Utilities
 *
 * Common formatting and status utilities used across document-related components.
 * Consolidates duplicated logic from:
 * - DocumentDetailView.tsx
 * - DocumentCard.tsx
 * - DocumentGallery.tsx
 * - ExtractedFieldsEditor.tsx
 * - CreateTemplateFromFields.tsx
 */

// ============================================================================
// Types
// ============================================================================

export type DocumentStatus =
  | 'completed'
  | 'processing'
  | 'analyzing'
  | 'pending'
  | 'failed'
  | 'uploaded'
  | 'uploading';

export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'email' | 'phone';

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = (bytes / Math.pow(k, i)).toFixed(1);
  return `${value} ${sizes[i]}`;
}

/**
 * Formats a snake_case or kebab-case field name to Title Case
 * @param name - Field name (e.g., "invoice_number" or "invoice-number")
 * @returns Formatted name (e.g., "Invoice Number")
 */
export function formatFieldName(name: string): string {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================================
// Status Utilities
// ============================================================================

/**
 * Status color mappings for badges and indicators
 */
const STATUS_COLORS: Record<DocumentStatus, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  analyzing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  pending: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  uploaded: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  uploading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

/**
 * Status labels for display
 */
const STATUS_LABELS: Record<DocumentStatus, string> = {
  completed: 'Completed',
  processing: 'Processing',
  analyzing: 'Analyzing',
  pending: 'Pending',
  failed: 'Failed',
  uploaded: 'Uploaded',
  uploading: 'Uploading',
};

/**
 * Gets the CSS classes for a status badge
 * @param status - Document processing status
 * @returns Tailwind CSS classes for the status color
 */
export function getStatusColor(status?: string): string {
  if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  return STATUS_COLORS[status as DocumentStatus] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

/**
 * Gets the human-readable label for a status
 * @param status - Document processing status
 * @returns Display label for the status
 */
export function getStatusLabel(status?: string): string {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status as DocumentStatus] ?? status;
}

/**
 * Checks if a status indicates active processing
 * @param status - Document processing status
 * @returns true if the document is currently being processed
 */
export function isProcessingStatus(status?: string): boolean {
  return status === 'analyzing' ||
         status === 'processing' ||
         status === 'uploading' ||
         status === 'pending';
}

/**
 * Checks if a status indicates completion (success or failure)
 * @param status - Document processing status
 * @returns true if the document has finished processing
 */
export function isTerminalStatus(status?: string): boolean {
  return status === 'completed' || status === 'failed';
}

// ============================================================================
// Field Type Utilities
// ============================================================================

/**
 * Infers a field type from the field name and value
 * @param fieldName - Name of the field
 * @param value - Value of the field
 * @returns Inferred field type
 */
export function inferFieldType(fieldName: string, value: string): FieldType {
  const name = fieldName.toLowerCase();

  if (name.includes('email') && value.includes('@')) {
    return 'email';
  }
  if (name.includes('phone') || /^\+?\d[\d\s\-()]+$/.test(value)) {
    return 'phone';
  }
  if (name.includes('date') || /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(value)) {
    return 'date';
  }
  if (name.includes('amount') || name.includes('price') || name.includes('total') || /^\$?\d+\.?\d*$/.test(value)) {
    return 'currency';
  }
  if (/^\d+\.?\d*$/.test(value)) {
    return 'number';
  }

  return 'text';
}

// ============================================================================
// Data Parsing Utilities
// ============================================================================

/**
 * Parses extracted fields data that may be stored as JSON string or object
 * Handles double-stringification issues from Supabase storage
 * @param data - Raw extracted fields data
 * @returns Parsed fields object
 */
export function parseExtractedFields(data: unknown): Record<string, unknown> {
  if (!data) return {};

  // If it's already an object, return it
  if (typeof data === 'object' && data !== null) {
    return data as Record<string, unknown>;
  }

  // If it's a string, try to parse it
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch (e) {
      console.error('[parseExtractedFields] Failed to parse JSON string:', e);
    }
  }

  return {};
}

/**
 * Extracts a simple display value from a potentially nested field structure
 * @param value - Field value that may be nested
 * @returns Simple string value for display
 */
export function extractSimpleValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);

  const obj = value as Record<string, unknown>;

  // If it has a 'value' property, use that
  if ('value' in obj) return String(obj.value || '');

  // If it's an array, join values
  if (Array.isArray(value)) {
    return value.map(v => extractSimpleValue(v)).join(', ');
  }

  // Otherwise try to stringify nicely
  return JSON.stringify(value);
}
