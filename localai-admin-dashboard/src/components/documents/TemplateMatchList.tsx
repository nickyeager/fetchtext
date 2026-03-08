import { useNavigate } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileText, Zap, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getMatchScoreColor,
  getMatchScoreBadgeVariant,
} from '@/lib/confidence-utils'
import type { TemplateSuggestion } from './TemplateMatchCard'

interface TemplateMatchListProps {
  suggestions: TemplateSuggestion[]
  onSelectTemplate?: (templateId: number) => void
  selectedTemplateId?: number
}

export function TemplateMatchList({
  suggestions,
  onSelectTemplate,
  selectedTemplateId,
}: TemplateMatchListProps) {
  const navigate = useNavigate()

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className='py-8 text-center text-sm text-muted-foreground'>
        No template matches found for this document.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className='w-8'></TableHead>
          <TableHead>Template</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className='w-48'>Match Score</TableHead>
          <TableHead className='w-20 text-center'>Fields</TableHead>
          <TableHead className='w-24'></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suggestions.map((suggestion, index) => {
          const isSelected = selectedTemplateId === suggestion.template_id
          const percent = Math.round(suggestion.match_score * 100)

          return (
            <TableRow
              key={suggestion.template_id}
              className={cn(
                'cursor-pointer',
                isSelected && 'bg-primary/5'
              )}
              onClick={() =>
                navigate({ to: `/templates/${suggestion.template_id}` })
              }
            >
              <TableCell>
                {index === 0 && (
                  <Star className='h-4 w-4 fill-yellow-400 text-yellow-400' />
                )}
              </TableCell>
              <TableCell>
                <div className='flex items-center gap-2'>
                  <span className='font-medium'>{suggestion.template_name}</span>
                  {index === 0 && (
                    <Badge variant='secondary' className='text-[10px]'>
                      Recommended
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant='outline' className='text-xs'>
                  {suggestion.category}
                </Badge>
              </TableCell>
              <TableCell>
                <div className='flex items-center gap-2'>
                  <Progress value={percent} className='h-2 w-24' />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      getMatchScoreColor(suggestion.match_score)
                    )}
                  >
                    {percent}%
                  </span>
                </div>
              </TableCell>
              <TableCell className='text-center'>
                <span className='flex items-center justify-center gap-1 text-sm text-muted-foreground'>
                  <FileText className='h-3 w-3' />
                  {suggestion.field_count}
                </span>
              </TableCell>
              <TableCell>
                {onSelectTemplate && (
                  <Button
                    size='sm'
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectTemplate(suggestion.template_id)
                    }}
                    disabled={isSelected}
                  >
                    <Zap className='mr-1 h-3 w-3' />
                    {isSelected ? 'Active' : 'Use'}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
