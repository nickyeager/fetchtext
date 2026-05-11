/**
 * ConfidenceBadge Component
 *
 * A reusable badge component for displaying AI confidence scores.
 * Consolidates confidence display logic from:
 * - ExtractedFieldsEditor.tsx
 * - DocumentPipelineView.tsx
 * - TemplateSelector.tsx
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  getConfidenceColor,
  getConfidenceBadgeVariant,
  formatConfidencePercent,
  formatConfidenceWithLabel,
  getConfidenceLevel,
} from '@/lib/confidence-utils';

// ============================================================================
// Types
// ============================================================================

interface ConfidenceBadgeProps {
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Whether to show the confidence level label (High/Medium/Low) */
  showLabel?: boolean;
  /** Whether to use colored background or just text */
  variant?: 'colored' | 'outline' | 'auto';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConfidenceBadge displays an AI confidence score with appropriate
 * coloring based on the confidence level.
 *
 * @example
 * ```tsx
 * <ConfidenceBadge confidence={0.85} />
 * <ConfidenceBadge confidence={0.65} showLabel />
 * <ConfidenceBadge confidence={field.confidence} variant="outline" />
 * ```
 */
export function ConfidenceBadge({
  confidence,
  showLabel = false,
  variant = 'colored',
  size = 'md',
  className = '',
}: ConfidenceBadgeProps) {
  // Don't render for zero or undefined confidence
  if (confidence === undefined || confidence === null || confidence <= 0) {
    return null;
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-xs';
  const displayText = showLabel
    ? formatConfidenceWithLabel(confidence)
    : formatConfidencePercent(confidence);

  // Determine badge styling based on variant
  if (variant === 'outline') {
    return (
      <Badge
        variant="outline"
        className={`${sizeClasses} ${className}`}
        data-testid="confidence-badge"
        data-confidence={confidence}
      >
        {displayText}
      </Badge>
    );
  }

  if (variant === 'auto') {
    return (
      <Badge
        variant={getConfidenceBadgeVariant(confidence)}
        className={`${sizeClasses} ${className}`}
        data-testid="confidence-badge"
        data-confidence={confidence}
      >
        {displayText}
      </Badge>
    );
  }

  // Default: colored variant
  return (
    <Badge
      variant="secondary"
      className={`${getConfidenceColor(confidence)} ${sizeClasses} ${className}`}
      data-testid="confidence-badge"
      data-confidence={confidence}
    >
      {displayText}
    </Badge>
  );
}

/**
 * MatchScoreBadge - Similar to ConfidenceBadge but styled for template match scores
 */
export function MatchScoreBadge({
  score,
  showLabel = false,
  className = '',
}: {
  score: number;
  showLabel?: boolean;
  className?: string;
}) {
  const percent = `${Math.round(score * 100)}%`;
  const level = getConfidenceLevel(score);
  const labels = { high: 'match', medium: 'match', low: 'match', none: '' };

  return (
    <Badge
      variant={getConfidenceBadgeVariant(score)}
      className={`text-xs ${className}`}
      data-testid="match-score-badge"
    >
      {percent}
      {showLabel && labels[level] && ` ${labels[level]}`}
    </Badge>
  );
}

export default ConfidenceBadge;
