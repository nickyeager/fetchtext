import React from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResizableDividerProps {
  /** Handler for drag start event */
  onDrag: (e: React.MouseEvent) => void
  /** Optional additional CSS classes */
  className?: string
}

/**
 * Resizable divider component with drag handle
 * Used between panels in split view layouts
 */
export function ResizableDivider({ onDrag, className }: ResizableDividerProps) {
  return (
    <div
      role="separator"
      aria-label="Resize panels"
      aria-orientation="vertical"
      className={cn(
        'w-2 bg-border hover:bg-primary/50 cursor-col-resize',
        'flex items-center justify-center transition-colors',
        className
      )}
      onMouseDown={onDrag}
    >
      <GripVertical className="h-6 w-6 text-muted-foreground" />
    </div>
  )
}
