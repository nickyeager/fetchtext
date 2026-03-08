import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, Zap, FileText, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getMatchScoreColor,
  getMatchScoreBadgeVariant,
  getConfidenceLevel,
} from '@/lib/confidence-utils'

export interface TemplateSuggestion {
  template_id: number
  template_name: string
  match_score: number
  category: string
  field_count: number
  extraction_quality?: number
  combined_score?: number
}

interface TemplateMatchCardProps {
  suggestions: TemplateSuggestion[]
  onSelectTemplate?: (templateId: number) => void
  onViewTemplate?: (templateId: number) => void
  selectedTemplateId?: number
  compact?: boolean
}

function ScoreRing({
  score,
  size = 80,
}: {
  score: number
  size?: number
}) {
  const percent = Math.round(score * 100)
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score * circumference)
  const level = getConfidenceLevel(score)

  const strokeColor = {
    high: 'stroke-green-500',
    medium: 'stroke-yellow-500',
    low: 'stroke-red-500',
    none: 'stroke-muted',
  }[level]

  return (
    <div className='relative' style={{ width: size, height: size }}>
      <svg className='rotate-[-90deg]' width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          className='stroke-muted'
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          className={cn(strokeColor, 'transition-all duration-500')}
          strokeWidth={6}
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className='absolute inset-0 flex items-center justify-center'>
        <span className={cn('text-lg font-bold', getMatchScoreColor(score))}>
          {percent}%
        </span>
      </div>
    </div>
  )
}

export function TemplateMatchCard({
  suggestions,
  onSelectTemplate,
  onViewTemplate,
  selectedTemplateId,
  compact = false,
}: TemplateMatchCardProps) {
  const navigate = useNavigate()
  const [showAlternatives, setShowAlternatives] = useState(false)

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card>
        <CardContent className='py-6 text-center'>
          <Target className='mx-auto mb-2 h-8 w-8 text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>
            No template matches found
          </p>
        </CardContent>
      </Card>
    )
  }

  const primary = suggestions[0]
  const alternatives = suggestions.slice(1, 5)
  const isSelected = selectedTemplateId === primary.template_id

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Target className='h-4 w-4' />
          Template Match
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Primary match */}
        <div
          className={cn(
            'flex items-center gap-4 rounded-lg border p-4',
            isSelected
              ? 'border-primary bg-primary/5'
              : 'border-border'
          )}
        >
          <ScoreRing score={primary.match_score} size={compact ? 64 : 80} />
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <h4 className='truncate font-semibold'>
                {primary.template_name}
              </h4>
              <Badge variant='outline' className='shrink-0 text-xs'>
                {primary.category}
              </Badge>
            </div>
            <div className='mt-1 flex items-center gap-3 text-sm text-muted-foreground'>
              <span className='flex items-center gap-1'>
                <FileText className='h-3 w-3' />
                {primary.field_count} fields
              </span>
              {primary.extraction_quality != null && (
                <span>
                  Extraction:{' '}
                  {Math.round(primary.extraction_quality * 100)}%
                </span>
              )}
            </div>
          </div>
          <div className='flex shrink-0 flex-col gap-2'>
            {onSelectTemplate && (
              <Button
                size='sm'
                onClick={() => onSelectTemplate(primary.template_id)}
                disabled={isSelected}
              >
                <Zap className='mr-1 h-3 w-3' />
                {isSelected ? 'Selected' : 'Use'}
              </Button>
            )}
            <Button
              size='sm'
              variant='ghost'
              onClick={() =>
                onViewTemplate
                  ? onViewTemplate(primary.template_id)
                  : navigate({ to: `/templates/${primary.template_id}` })
              }
            >
              View
            </Button>
          </div>
        </div>

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <Collapsible open={showAlternatives} onOpenChange={setShowAlternatives}>
            <CollapsibleTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                className='w-full justify-between text-muted-foreground'
              >
                {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    showAlternatives && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='space-y-2 pt-2'>
              {alternatives.map((alt) => (
                <div
                  key={alt.template_id}
                  className={cn(
                    'flex items-center gap-3 rounded-md border p-3',
                    selectedTemplateId === alt.template_id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  )}
                >
                  <Badge
                    variant={getMatchScoreBadgeVariant(alt.match_score)}
                    className='shrink-0'
                  >
                    {Math.round(alt.match_score * 100)}%
                  </Badge>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                      {alt.template_name}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {alt.category} &middot; {alt.field_count} fields
                    </p>
                  </div>
                  {onSelectTemplate && (
                    <Button
                      size='sm'
                      variant='outline'
                      className='shrink-0'
                      onClick={() => onSelectTemplate(alt.template_id)}
                      disabled={selectedTemplateId === alt.template_id}
                    >
                      Use
                    </Button>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}
