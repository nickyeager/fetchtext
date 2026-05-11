import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface InlineFieldEditorProps {
  /** The field name being edited */
  fieldName: string
  /** The current value of the field */
  currentValue: string | null
  /** Callback when save is clicked */
  onSave: (newValue: string) => void | Promise<void>
  /** Callback when cancel is clicked */
  onCancel: () => void
  /** Additional class name */
  className?: string
}

export function InlineFieldEditor({
  fieldName,
  currentValue,
  onSave,
  onCancel,
  className,
}: InlineFieldEditorProps) {
  const [value, setValue] = useState(currentValue || '')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus and select all on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (value === currentValue || value.trim() === '') return

    setIsSaving(true)
    try {
      await onSave(value)
    } finally {
      setIsSaving(false)
    }
  }, [value, currentValue, onSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [handleSave, onCancel]
  )

  const isUnchanged = value === currentValue
  const isEmpty = value.trim() === ''
  const isSaveDisabled = isUnchanged || isEmpty || isSaving

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-1',
        'dark:border-amber-700 dark:bg-amber-950/30',
        className
      )}
    >
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="h-7 flex-1 border-0 bg-transparent text-sm focus-visible:ring-0"
        aria-label={`Edit ${fieldName}`}
      />

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={isSaveDisabled}
          className="h-6 w-6 p-0"
          aria-label="Save"
        >
          {isSaving ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              data-testid="loading-spinner"
            />
          ) : (
            <Check className="h-4 w-4 text-green-600" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="h-6 w-6 p-0"
          aria-label="Cancel"
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>

      {isSaving && (
        <span className="sr-only" role="status">
          Saving...
        </span>
      )}
    </div>
  )
}
