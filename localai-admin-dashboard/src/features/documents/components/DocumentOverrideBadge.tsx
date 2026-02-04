import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DocumentOverrideBadgeProps {
  /** Total number of overrides */
  overrideCount: number
  /** Number of field overrides (subset of total) */
  fieldOverrideCount?: number
  /** Whether there's a template content override */
  templateOverride?: boolean
  /** Whether any overrides have conflicts */
  hasConflicts?: boolean
  /** Callback when badge is clicked */
  onClick?: () => void
  /** Additional class name */
  className?: string
}

export function DocumentOverrideBadge({
  overrideCount,
  fieldOverrideCount,
  templateOverride = false,
  hasConflicts = false,
  onClick,
  className,
}: DocumentOverrideBadgeProps) {
  // Don't render if no overrides
  if (overrideCount === 0) {
    return null
  }

  const label = `${overrideCount} override${overrideCount !== 1 ? 's' : ''}`

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            data-testid="override-badge"
            variant="outline"
            className={cn(
              'gap-1 border-amber-300 bg-amber-50 text-amber-700',
              'dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
              onClick && 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50',
              className
            )}
            onClick={onClick}
            role="status"
            aria-label={`Document has ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`}
          >
            <Pencil className="h-3 w-3" data-testid="pencil-icon" />
            {label}

            {/* Conflict indicator */}
            {hasConflicts && (
              <span
                data-testid="conflict-dot"
                className="ml-1 h-2 w-2 rounded-full bg-red-500"
                aria-label="Has conflicts"
              />
            )}
          </Badge>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="text-sm">
          <div className="space-y-1">
            {fieldOverrideCount !== undefined && fieldOverrideCount > 0 && (
              <div>
                {fieldOverrideCount} field override{fieldOverrideCount !== 1 ? 's' : ''}
              </div>
            )}
            {templateOverride && (
              <div>Template modified</div>
            )}
            {hasConflicts && (
              <div className="text-red-500">
                Some overrides have conflicts with re-extracted values
              </div>
            )}
            {onClick && (
              <div className="text-muted-foreground text-xs">
                Click to manage overrides
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
