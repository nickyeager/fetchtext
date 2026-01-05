/**
 * Editable Variable Badge View
 *
 * Interactive badge component for displaying and editing field values inline.
 * Click to edit, blur/Enter to save, Escape to cancel.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Check, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EditableVariableBadgeViewProps {
  /** Variable ID/key */
  variableId: string
  /** Display name for the variable */
  variableName: string
  /** Current value (null if not extracted) */
  value: string | null
  /** Original extracted value (before any overrides) */
  originalValue: string | null
  /** Whether this value is an override */
  isOverride?: boolean
  /** Confidence score (0-1) */
  confidence?: number
  /** Callback when value is changed */
  onValueChange: (
    variableId: string,
    newValue: string,
    originalValue: string | null
  ) => Promise<void>
  /** Callback to reset override */
  onReset?: (variableId: string) => Promise<void>
  /** Whether editing is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

export function EditableVariableBadgeView({
  variableId,
  variableName,
  value,
  originalValue,
  isOverride = false,
  confidence,
  onValueChange,
  onReset,
  disabled = false,
  className,
}: EditableVariableBadgeViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [isHovered, setIsHovered] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync edit value when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value || '')
    }
  }, [value, isEditing])

  // Focus and select input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = useCallback(() => {
    if (!disabled && !isEditing) {
      setIsEditing(true)
    }
  }, [disabled, isEditing])

  const handleSave = useCallback(async () => {
    // Don't save if value hasn't changed
    if (editValue === (value || '')) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onValueChange(variableId, editValue, originalValue)
      setIsEditing(false)
    } catch (error) {
      // Keep editing mode on error
      console.error('[EditableVariableBadgeView] Save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }, [editValue, value, variableId, originalValue, onValueChange])

  const handleCancel = useCallback(() => {
    setEditValue(value || '')
    setIsEditing(false)
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  const handleBlur = useCallback(() => {
    handleSave()
  }, [handleSave])

  const handleReset = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onReset) {
        await onReset(variableId)
      }
    },
    [onReset, variableId]
  )

  const hasValue = value !== null && value !== ''

  // Editing mode - show input
  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isSaving}
        className={cn(
          'inline-flex h-7 w-auto min-w-[100px] px-2 py-1',
          'text-sm font-mono',
          'border-amber-300 focus-visible:ring-amber-400',
          className
        )}
      />
    )
  }

  // Display mode - show badge
  return (
    <span
      className="inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        data-testid="variable-badge"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 mx-0.5',
          'text-sm transition-colors',
          'cursor-pointer',
          // Base styling based on value state
          hasValue
            ? 'border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'
            : 'border border-dashed border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
          // Override styling
          isOverride &&
            'border-amber-300 border-dotted bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
          // Disabled styling
          disabled && 'cursor-not-allowed opacity-60',
          // Hover styling
          !disabled && 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
          className
        )}
      >
        {hasValue ? (
          <>
            <Check className="h-3 w-3" data-testid="value-present-icon" />
            <span>{value}</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3" data-testid="value-missing-icon" />
            <span className="font-mono italic">{`{{${variableId}}}`}</span>
          </>
        )}
      </button>

      {/* Reset button - shown on hover when override */}
      {isOverride && onReset && (
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'ml-1 h-4 w-4 p-0 text-amber-600 hover:text-amber-700',
            'transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={handleReset}
          aria-label="Reset to original"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </span>
  )
}
