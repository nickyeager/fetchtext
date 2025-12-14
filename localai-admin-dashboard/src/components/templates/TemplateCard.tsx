import { useState } from 'react'
import { Clock, Users, Play, Eye, MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkflowTemplate } from '@/types/workflows'
import { cn } from '@/lib/utils'

interface TemplateCardProps {
  template: WorkflowTemplate
  onPreview?: (template: WorkflowTemplate) => void
  onUse?: (template: WorkflowTemplate) => void
  onEdit?: (template: WorkflowTemplate) => void
  onDuplicate?: (template: WorkflowTemplate) => void
  onDelete?: (template: WorkflowTemplate) => void
  isOwner?: boolean
  className?: string
}

export function TemplateCard({
  template,
  onPreview,
  onUse,
  onEdit,
  onDuplicate,
  onDelete,
  isOwner = false,
  className,
}: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'beginner':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'advanced':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTemplateTypeColor = (type: string) => {
    switch (type) {
      case 'n8n':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'flowise':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'hybrid':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02]',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail/Preview Image */}
      <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        {template.thumbnailUrl ? (
          <img
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                {template.templateType === 'n8n' && (
                  <div className="w-6 h-6 bg-blue-500 rounded"></div>
                )}
                {template.templateType === 'flowise' && (
                  <div className="w-6 h-6 bg-purple-500 rounded"></div>
                )}
                {template.templateType === 'hybrid' && (
                  <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
                )}
                {template.templateType === 'other' && (
                  <div className="w-6 h-6 bg-gray-500 rounded"></div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{template.templateType.toUpperCase()}</p>
            </div>
          </div>
        )}
        
        {/* Overlay with quick actions */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 flex items-center justify-center space-x-2 transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onPreview?.(template)}
            className="bg-white/90 hover:bg-white text-black"
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={() => onUse?.(template)}
            className="bg-primary/90 hover:bg-primary text-primary-foreground"
          >
            <Play className="w-4 h-4 mr-1" />
            Use
          </Button>
        </div>

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex items-center space-x-1">
          <Badge className={getTemplateTypeColor(template.templateType)}>
            {template.templateType}
          </Badge>
          {template.complexity && (
            <Badge className={getComplexityColor(template.complexity)}>
              {template.complexity}
            </Badge>
          )}
        </div>

        {/* Actions menu */}
        {(isOwner || onDuplicate) && (
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-black"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(template)}>
                    Duplicate
                  </DropdownMenuItem>
                )}
                {isOwner && onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(template)}>
                    Edit
                  </DropdownMenuItem>
                )}
                {isOwner && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(template)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-1">
              {template.name}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {template.description || 'No description available'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-2">
        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-3">
            
            {template.usageCount !== undefined && (
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>{template.usageCount}</span>
              </div>
            )}
          </div>
          
          {template.estimatedTimeMinutes && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{template.estimatedTimeMinutes}m</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <div className="flex w-full space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPreview?.(template)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={() => onUse?.(template)}
            className="flex-1"
          >
            <Play className="w-4 h-4 mr-1" />
            Use Template 
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
