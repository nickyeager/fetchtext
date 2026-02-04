import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ResizableDivider } from './ResizableDivider'
export type { LayoutMode } from './EditorToolbar'

interface SplitPanelContainerProps {
  /** Current layout mode */
  layout: LayoutMode
  /** Left panel content (original document) */
  leftPanel: React.ReactNode
  /** Right panel content (template output) */
  rightPanel: React.ReactNode
  /** Initial split ratio (0-1, default 0.5) */
  initialSplitRatio?: number
  /** Minimum panel width as percentage (default 20) */
  minPanelWidth?: number
  /** Maximum panel width as percentage (default 80) */
  maxPanelWidth?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Container for split panel layout with resizable divider
 * Supports side-by-side, original-only, and output-only layouts
 */
export function SplitPanelContainer({
  layout,
  leftPanel,
  rightPanel,
  initialSplitRatio = 0.5,
  minPanelWidth = 20,
  maxPanelWidth = 80,
  className,
}: SplitPanelContainerProps) {
  const [splitRatio, setSplitRatio] = useState(initialSplitRatio)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleDrag = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      const container = document.getElementById('split-panel-container')
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width

      // Clamp to min/max
      const clampedRatio = Math.max(
        minPanelWidth / 100,
        Math.min(maxPanelWidth / 100, ratio)
      )
      setSplitRatio(clampedRatio)
    },
    [isDragging, minPanelWidth, maxPanelWidth]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Attach global mouse listeners for drag
  const handleMouseDown = useCallback(() => {
    handleDragStart()

    const onMouseMove = (e: MouseEvent) => handleDrag(e)
    const onMouseUp = () => {
      handleDragEnd()
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [handleDragStart, handleDrag, handleDragEnd])

  // Single panel layouts
  if (layout === 'original-only') {
    return (
      <div className={cn('flex h-full w-full', className)}>
        <div className="h-full w-full">{leftPanel}</div>
      </div>
    )
  }

  if (layout === 'output-only') {
    return (
      <div className={cn('flex h-full w-full', className)}>
        <div className="h-full w-full">{rightPanel}</div>
      </div>
    )
  }

  // Side-by-side layout
  const leftWidth = `${splitRatio * 100}%`
  const rightWidth = `${(1 - splitRatio) * 100}%`

  return (
    <div
      id="split-panel-container"
      className={cn(
        'flex h-full w-full',
        isDragging && 'select-none',
        className
      )}
    >
      {/* Left panel */}
      <div
        className="h-full overflow-auto"
        style={{ width: leftWidth }}
      >
        {leftPanel}
      </div>

      {/* Resizable divider */}
      <ResizableDivider onDrag={handleMouseDown} />

      {/* Right panel */}
      <div
        className="h-full overflow-auto"
        style={{ width: rightWidth }}
      >
        {rightPanel}
      </div>
    </div>
  )
}
