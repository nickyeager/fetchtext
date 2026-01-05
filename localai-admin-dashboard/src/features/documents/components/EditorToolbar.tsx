import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Save, Download, PanelLeft, PanelRight, Columns2, FileText, PenTool } from 'lucide-react'
import { ModeSelector, type EditMode } from './ModeSelector'
import type { ViewMode } from './SplitDocumentEditor'

export type LayoutMode = 'side-by-side' | 'original-only' | 'output-only'

interface EditorToolbarProps {
  /** Current edit mode */
  editMode: EditMode
  /** Callback when edit mode changes */
  onEditModeChange: (mode: EditMode) => void
  /** Current layout mode */
  layout: LayoutMode
  /** Callback when layout changes */
  onLayoutChange: (layout: LayoutMode) => void
  /** Current view mode */
  viewMode?: ViewMode
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void
  /** Whether there are unsaved changes */
  hasChanges: boolean
  /** Callback to save changes */
  onSave?: () => void
  /** Callback to export document */
  onExport?: () => void
  /** Template name to display */
  templateName?: string
  /** Field count for display */
  fieldCount?: { filled: number; total: number }
  /** Number of overrides applied */
  overrideCount?: number
  /** Whether toolbar is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

interface LayoutButtonProps {
  layout: LayoutMode
  currentLayout: LayoutMode
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function LayoutButton({ layout, currentLayout, onClick, icon, label }: LayoutButtonProps) {
  const isActive = layout === currentLayout
  return (
    <Button
      variant={isActive ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      data-active={isActive}
      aria-label={label}
      className="h-8"
    >
      {icon}
    </Button>
  )
}

/**
 * Toolbar for the split document editor
 * Contains mode selector, layout controls, and action buttons
 */
export function EditorToolbar({
  editMode,
  onEditModeChange,
  layout,
  onLayoutChange,
  viewMode = 'simple',
  onViewModeChange,
  hasChanges,
  onSave,
  onExport,
  templateName,
  fieldCount,
  overrideCount,
  disabled,
  className,
}: EditorToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b bg-muted/30 px-4 py-2',
        className
      )}
    >
      {/* Left section: Mode selector and template info */}
      <div className="flex items-center gap-3">
        <ModeSelector
          value={editMode}
          onChange={onEditModeChange}
          templateName={templateName}
          disabled={disabled}
        />

        {templateName && (
          <span className="text-sm text-muted-foreground">
            {templateName}
          </span>
        )}

        {fieldCount && (
          <Badge variant="secondary" className="text-xs">
            {fieldCount.filled}/{fieldCount.total}
          </Badge>
        )}

        {overrideCount !== undefined && overrideCount > 0 && (
          <Badge variant="outline" className="text-xs text-amber-600">
            {overrideCount} overrides
          </Badge>
        )}
      </div>

      {/* Center section: Layout and view controls */}
      <div className="flex items-center gap-4">
        {/* Layout controls */}
        <div className="flex items-center gap-1 rounded-md border bg-background p-1">
          <LayoutButton
            layout="side-by-side"
            currentLayout={layout}
            onClick={() => onLayoutChange('side-by-side')}
            icon={<Columns2 className="h-4 w-4" />}
            label="Side by side"
          />
          <LayoutButton
            layout="original-only"
            currentLayout={layout}
            onClick={() => onLayoutChange('original-only')}
            icon={<PanelLeft className="h-4 w-4" />}
            label="Original only"
          />
          <LayoutButton
            layout="output-only"
            currentLayout={layout}
            onClick={() => onLayoutChange('output-only')}
            icon={<PanelRight className="h-4 w-4" />}
            label="Output only"
          />
        </div>

        {/* View mode toggle */}
        {onViewModeChange && (
          <div className="flex items-center gap-1 rounded-md border bg-background p-1">
            <Button
              variant={viewMode === 'simple' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('simple')}
              aria-label="Simple view"
              className="h-8 gap-1.5"
            >
              <FileText className="h-4 w-4" />
              <span className="text-xs">Simple</span>
            </Button>
            <Button
              variant={viewMode === 'wysiwyg' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('wysiwyg')}
              aria-label="Rich editor view"
              className="h-8 gap-1.5"
            >
              <PenTool className="h-4 w-4" />
              <span className="text-xs">Editor</span>
            </Button>
          </div>
        )}
      </div>

      {/* Right section: Action buttons */}
      <div className="flex items-center gap-2">
        {hasChanges && onSave && (
          <Button size="sm" onClick={onSave} disabled={disabled}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        )}

        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={disabled}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </div>
    </div>
  )
}
