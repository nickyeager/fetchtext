/**
 * Shared Confidence Score Utilities
 *
 * Common utilities for displaying and working with AI confidence scores.
 * Consolidates duplicated logic from:
 * - ExtractedFieldsEditor.tsx
 * - DocumentPipelineView.tsx
 * - TemplateSelector.tsx
 */

// ============================================================================
// Types
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// ============================================================================
// Confidence Level Utilities
// ============================================================================

/**
 * Determines the confidence level category from a numeric score
 * @param confidence - Confidence score between 0 and 1
 * @returns Confidence level category
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  if (confidence > 0) return 'low';
  return 'none';
}

/**
 * Confidence color mappings for different display contexts
 */
const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400',
  low: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
  none: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * Gets CSS classes for confidence-based coloring
 * @param confidence - Confidence score between 0 and 1
 * @returns Tailwind CSS classes for the confidence color
 */
export function getConfidenceColor(confidence: number): string {
  return CONFIDENCE_COLORS[getConfidenceLevel(confidence)];
}

/**
 * Text color only mappings (for inline text, not badges)
 */
const CONFIDENCE_TEXT_COLORS: Record<ConfidenceLevel, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-red-600 dark:text-red-400',
  none: 'text-gray-500 dark:text-gray-400',
};

/**
 * Gets text-only CSS classes for confidence-based coloring
 * @param confidence - Confidence score between 0 and 1
 * @returns Tailwind CSS text color classes
 */
export function getConfidenceTextColor(confidence: number): string {
  return CONFIDENCE_TEXT_COLORS[getConfidenceLevel(confidence)];
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Formats a confidence score as a percentage string
 * @param confidence - Confidence score between 0 and 1
 * @returns Formatted percentage (e.g., "85%")
 */
export function formatConfidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Formats a confidence score with optional label
 * @param confidence - Confidence score between 0 and 1
 * @param includeLabel - Whether to include the level label
 * @returns Formatted string (e.g., "85% High" or "85%")
 */
export function formatConfidenceWithLabel(confidence: number, includeLabel = true): string {
  const percent = formatConfidencePercent(confidence);
  if (!includeLabel) return percent;

  const level = getConfidenceLevel(confidence);
  const labels: Record<ConfidenceLevel, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: '',
  };

  const label = labels[level];
  return label ? `${percent} ${label}` : percent;
}

// ============================================================================
// Badge Variant Utilities
// ============================================================================

/**
 * Gets the appropriate badge variant for a confidence level
 * Used with shadcn/ui Badge component
 * @param confidence - Confidence score between 0 and 1
 * @returns Badge variant name
 */
export function getConfidenceBadgeVariant(confidence: number): BadgeVariant {
  const level = getConfidenceLevel(confidence);
  const variants: Record<ConfidenceLevel, BadgeVariant> = {
    high: 'default',
    medium: 'secondary',
    low: 'destructive',
    none: 'outline',
  };
  return variants[level];
}

// ============================================================================
// Match Score Utilities (for template matching)
// ============================================================================

/**
 * Gets the appropriate badge variant for a match score
 * @param score - Match score between 0 and 1
 * @returns Badge variant name
 */
export function getMatchScoreBadgeVariant(score: number): BadgeVariant {
  if (score >= 0.8) return 'default';
  if (score >= 0.6) return 'secondary';
  return 'outline';
}

/**
 * Gets text color classes for a match score
 * @param score - Match score between 0 and 1
 * @returns Tailwind CSS text color classes
 */
export function getMatchScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400';
  if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}
