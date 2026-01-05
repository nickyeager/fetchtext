import { FileEdit, Edit } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type EditMode = 'override' | 'template'

interface ModeSelectorProps {
  /** Current selected mode */
  value: EditMode
  /** Callback when mode changes */
  onChange: (mode: EditMode) => void
  /** Template name to show in description */
  templateName?: string
  /** Whether the selector is disabled */
  disabled?: boolean
}

/**
 * Dropdown selector for choosing between document override and template edit modes
 */
export function ModeSelector({
  value,
  onChange,
  templateName,
  disabled = false,
}: ModeSelectorProps) {
  const handleValueChange = (newValue: string) => {
    onChange(newValue as EditMode)
  }

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger className="w-[240px]" aria-label="Select edit mode">
        <SelectValue>
          {value === 'override' ? (
            <span className="flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-amber-600" />
              Override this document
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-blue-600" />
              Edit global template
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="override">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-amber-600" />
              Override this document
            </span>
            <span className="text-xs text-muted-foreground ml-6">
              Only affects this document. Template remains unchanged.
            </span>
          </div>
        </SelectItem>
        <SelectItem value="template">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-blue-600" />
              Edit global template
            </span>
            <span className="text-xs text-muted-foreground ml-6">
              Changes apply to all documents using{' '}
              {templateName ? `"${templateName}"` : 'this template'}.
            </span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
