/**
 * StatusBadge Component
 *
 * A reusable badge component for displaying document processing status.
 * Consolidates status display logic from:
 * - DocumentDetailView.tsx
 * - DocumentCard.tsx
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  FileText,
  Upload,
} from 'lucide-react';
import { getStatusColor, getStatusLabel, type DocumentStatus } from '@/lib/document-utils';

// ============================================================================
// Types
// ============================================================================

interface StatusBadgeProps {
  /** Document processing status */
  status?: string;
  /** Whether to show the status icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

// ============================================================================
// Icon Mapping
// ============================================================================

const STATUS_ICONS: Record<DocumentStatus, React.ReactNode> = {
  completed: <CheckCircle className="w-3.5 h-3.5" />,
  processing: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  analyzing: <Sparkles className="w-3.5 h-3.5" />,
  pending: <Sparkles className="w-3.5 h-3.5" />,
  failed: <AlertTriangle className="w-3.5 h-3.5" />,
  uploaded: <FileText className="w-3.5 h-3.5" />,
  uploading: <Upload className="w-3.5 h-3.5 animate-pulse" />,
};

/**
 * Gets the icon for a status, with fallback for unknown statuses
 */
function getStatusIcon(status?: string): React.ReactNode {
  if (!status) return <FileText className="w-3.5 h-3.5" />;
  return STATUS_ICONS[status as DocumentStatus] ?? <FileText className="w-3.5 h-3.5" />;
}

// ============================================================================
// Component
// ============================================================================

/**
 * StatusBadge displays the current processing status of a document
 * with appropriate coloring and optional icon.
 *
 * @example
 * ```tsx
 * <StatusBadge status="completed" />
 * <StatusBadge status="processing" showIcon={false} />
 * <StatusBadge status={document.processing_status} size="sm" />
 * ```
 */
export function StatusBadge({
  status,
  showIcon = true,
  className = '',
  size = 'md',
}: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : '';

  return (
    <Badge
      className={`${getStatusColor(status)} ${sizeClasses} ${className}`}
      data-testid="status-badge"
      data-status={status || 'unknown'}
    >
      {showIcon && (
        <span className="mr-1 inline-flex items-center">
          {getStatusIcon(status)}
        </span>
      )}
      <span>{getStatusLabel(status)}</span>
    </Badge>
  );
}

export default StatusBadge;
