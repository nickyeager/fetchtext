import { Check, Pencil, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FieldOverrideIndicatorProps {
  /** The field name */
  fieldName: string
  /** Current value (may be override or extracted) */
  value: string | number | null
  /** Original extracted value (before override) */
  originalValue?: string | number | null
  /** Whether this field has an override */
  isOverride: boolean
  /** Confidence score from extraction (0-1) */
  confidence?: number
  /** Who modified this field */
  modifiedBy?: string
  /** When it was modified */
  modifiedAt?: string
  /** Callback when reset is clicked */
  onReset?: (fieldName: string) => void
  /** Callback when field is double-clicked to edit */
  onEdit?: (fieldName: string, currentValue: string | number | null) => void
  /** Whether the field is read-only */
  readOnly?: boolean
  /** Whether there's a conflict with re-extracted value */
  hasConflict?: boolean
  /** The new re-extracted value that differs */
  conflictNewValue?: string | number | null
  /** Additional class name */
  className?: string
}

export function FieldOverrideIndicator({
  fieldName,
  value,
  originalValue,
  isOverride,
  confidence,
  modifiedBy,
  modifiedAt,
  onReset,
  onEdit,
  readOnly = false,
  hasConflict = false,
  conflictNewValue,
  className,
}: FieldOverrideIndicatorProps) {
  const hasValue = value !== null && value !== ''
  const displayValue = hasValue ? String(value) : null

  const handleDoubleClick = () => {
    if (!readOnly && onEdit) {
      onEdit(fieldName, value)
    }
  }

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation()
    onReset?.(fieldName)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="field-indicator"
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
              'cursor-help transition-colors',
              // Base styling based on override status
              isOverride
                ? 'border border-dotted border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                : 'border border-solid border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200',
              // Make clickable when editable
              !readOnly && 'hover:brightness-95',
              className
            )}
            onDoubleClick={handleDoubleClick}
            aria-label={`${fieldName}: ${displayValue || 'no value'}${isOverride ? ' (modified from original)' : ''}`}
          >
            {/* Icon */}
            {isOverride ? (
              <Pencil className="h-3 w-3" data-testid="pencil-icon" />
            ) : (
              <Check className="h-3 w-3" data-testid="check-icon" />
            )}

            {/* Value */}
            {hasValue ? (
              <span className="max-w-[200px] truncate">{displayValue}</span>
            ) : (
              <span className="italic text-muted-foreground">No value</span>
            )}

            {/* Reset button for overrides - use span to avoid button-in-button */}
            {isOverride && onReset && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleReset}
                onKeyDown={(e) => e.key === 'Enter' && handleReset(e as unknown as React.MouseEvent)}
                className="ml-1 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded hover:bg-amber-200 dark:hover:bg-amber-800"
                aria-label="Reset to original"
              >
                <X className="h-3 w-3" />
              </span>
            )}

            {/* Conflict warning */}
            {hasConflict && (
              <AlertTriangle
                className="ml-1 h-3 w-3 text-red-500"
                data-testid="conflict-warning"
              />
            )}

            {/* Screen reader text */}
            {isOverride && (
              <span className="sr-only">Modified from original</span>
            )}
          </button>
        </TooltipTrigger>

        <TooltipContent side="top" className="max-w-sm space-y-2 p-3">
          {/* Field name */}
          <div className="font-mono text-xs text-muted-foreground">
            {fieldName}
          </div>

          {/* Override info */}
          {isOverride && originalValue !== undefined && (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">Original value: </span>
                <span className="font-medium">{String(originalValue)}</span>
              </div>
              {modifiedBy && (
                <div className="text-xs text-muted-foreground">
                  <span>Modified by: </span>
                  <span>{modifiedBy}</span>
                </div>
              )}
              {modifiedAt && (
                <div className="text-xs text-muted-foreground">
                  {new Date(modifiedAt).toLocaleString()}
                </div>
              )}
            </>
          )}

          {/* Confidence for non-overrides */}
          {!isOverride && confidence !== undefined && (
            <div
              className={cn(
                'text-xs',
                confidence >= 0.9
                  ? 'text-green-600'
                  : confidence >= 0.7
                    ? 'text-yellow-600'
                    : 'text-red-600'
              )}
            >
              {Math.round(confidence * 100)}% confidence
            </div>
          )}

          {/* Conflict warning */}
          {hasConflict && conflictNewValue !== undefined && (
            <div className="border-t pt-2 text-xs text-red-600">
              <span className="font-medium">Re-extracted value differs: </span>
              <span>{String(conflictNewValue)}</span>
            </div>
          )}

          {/* Edit hint */}
          {!readOnly && (
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Double-click to edit
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
