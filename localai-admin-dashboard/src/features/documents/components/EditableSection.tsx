import { useState, useRef, useEffect } from 'react'
import { Check, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
export type { EditMode } from './ModeSelector'

interface EditableSectionProps {
  /** Unique identifier for this section */
  sectionId: string
  /** Text content of the section */
  content: string
  /** Whether the section is currently being edited */
  isEditing: boolean
  /** Whether this section has an override applied */
  isOverride?: boolean
  /** Original content before override */
  originalContent?: string
  /** Callback when section is clicked to start editing */
  onEdit: (sectionId: string) => void
  /** Callback when edit is saved */
  onSave: (sectionId: string, newContent: string) => Promise<void>
  /** Callback when edit is cancelled */
  onCancel: () => void
  /** Callback to reset override */
  onReset?: (sectionId: string) => void
  /** Whether the section is read-only */
  readOnly?: boolean
  /** Current edit mode */
  editMode: EditMode
  /** Optional additional CSS classes */
  className?: string
}

/**
 * A text section that can be clicked to edit inline.
 * Used in SectionRenderer to make template text editable.
 */
export function EditableSection({
  sectionId,
  content,
  isEditing,
  isOverride = false,
  originalContent,
  onEdit,
  onSave,
  onCancel,
  onReset,
  readOnly = false,
  editMode,
  className,
}: EditableSectionProps) {
  const [editValue, setEditValue] = useState(content)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync edit value when content changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(content)
    }
  }, [content, isEditing])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleClick = () => {
    if (!readOnly && !isEditing) {
      onEdit(sectionId)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(sectionId, editValue)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    }
  }

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation()
    onReset?.(sectionId)
  }

  if (isEditing) {
    return (
      <span className={cn('inline-block w-full', className)}>
        <div className="flex flex-col gap-2">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] resize-y border-amber-300 focus-visible:ring-amber-400"
            disabled={isSaving}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              aria-label="Save"
            >
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              aria-label="Cancel"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </span>
    )
  }

  return (
    <span
      role="button"
      tabIndex={readOnly ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onEdit(sectionId)
        }
      }}
      className={cn(
        'relative inline cursor-pointer rounded px-0.5',
        'transition-colors duration-150',
        'hover:bg-blue-50 dark:hover:bg-blue-950/30',
        isOverride && 'bg-amber-50 border-b border-dotted border-amber-300 dark:bg-amber-950/20',
        readOnly && 'cursor-default hover:bg-transparent',
        className
      )}
    >
      {content}
      {isOverride && onReset && (
        <Button
          size="sm"
          variant="ghost"
          className="ml-1 h-5 w-5 p-0 text-amber-600 hover:text-amber-700"
          onClick={handleReset}
          aria-label="Reset to original"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </span>
  )
}
