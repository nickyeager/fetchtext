import { useState } from 'react'
import { X, Play, Clock, Users, Tag, Download, Share2, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WorkflowTemplate } from '@/types/workflows'
import { cn } from '@/lib/utils'

interface TemplatePreviewModalProps {
  template: WorkflowTemplate | null
  isOpen: boolean
  onClose: () => void
  onUse?: (template: WorkflowTemplate) => void
  onDuplicate?: (template: WorkflowTemplate) => void
}

export function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onUse,
  onDuplicate,
}: TemplatePreviewModalProps) {

  if (!template) return null

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


  const renderWorkflowNodes = () => {
    if (!template.nodes || template.nodes.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No workflow details available</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {template.nodes.map((node, index) => (
          <div key={node.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-medium">{node.name}</h4>
                <p className="text-sm text-muted-foreground">{node.type}</p>
              </div>
              <Badge variant="outline" className="ml-2">
                {index + 1}
              </Badge>
            </div>
            
            {Object.keys(node.parameters).length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-2">Configuration:</p>
                <div className="bg-muted/50 rounded p-2 text-xs">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(node.parameters, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold mb-2">
                {template.name}
              </DialogTitle>
              <DialogDescription className="text-base">
                {template.description || 'No description available'}
              </DialogDescription>
              
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge className={getTemplateTypeColor(template.templateType)}>
                  {template.templateType.toUpperCase()}
                </Badge>
                {template.complexity && (
                  <Badge className={getComplexityColor(template.complexity)}>
                    {template.complexity}
                  </Badge>
                )}
                {template.tags?.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6">
          <Separator />
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              
              {template.usageCount !== undefined && (
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{template.usageCount}</span>
                  <span className="text-sm text-muted-foreground">uses</span>
                </div>
              )}
              
              {template.estimatedTimeMinutes && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{template.estimatedTimeMinutes}m</span>
                  <span className="text-sm text-muted-foreground">setup</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Heart className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
              {onDuplicate && (
                <Button variant="outline" size="sm" onClick={() => onDuplicate(template)}>
                  <Download className="w-4 h-4 mr-1" />
                  Duplicate
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="workflow">Workflow</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <TabsContent value="overview" className="mt-0">
                    <div className="space-y-6">
                      {/* Thumbnail */}
                      {template.thumbnailUrl && (
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                          <img
                            src={template.thumbnailUrl}
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Description */}
                      <div>
                        <h3 className="font-semibold mb-2">Description</h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {template.description || 'No detailed description available for this template.'}
                        </p>
                      </div>
                      
                      {/* What You'll Build */}
                      <div>
                        <h3 className="font-semibold mb-2">What You'll Build</h3>
                        <p className="text-muted-foreground">
                          This {template.templateType} workflow template will help you automate{' '}
                          {template.category?.toLowerCase() || 'various tasks'} with{' '}
                          {template.nodes?.length || 0} configured nodes.
                        </p>
                      </div>
                      
                      {/* Requirements */}
                      <div>
                        <h3 className="font-semibold mb-2">Requirements</h3>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• {template.templateType === 'n8n' ? 'N8N instance' : template.templateType === 'flowise' ? 'Flowise instance' : 'Compatible automation platform'}</li>
                          <li>• Basic understanding of workflow automation</li>
                          {template.complexity === 'intermediate' && <li>• Intermediate automation experience</li>}
                          {template.complexity === 'advanced' && <li>• Advanced automation and API knowledge</li>}
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="workflow" className="mt-0">
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold mb-4">Workflow Nodes</h3>
                        {renderWorkflowNodes()}
                      </div>
                      
                      {template.connections && template.connections.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-4">Node Connections</h3>
                          <div className="space-y-2">
                            {template.connections.map((connection, index) => (
                              <div key={index} className="text-sm text-muted-foreground">
                                {connection.sourceNode} → {connection.targetNode}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="details" className="mt-0">
                    <div className="space-y-6">
                      {/* Template Data */}
                      {template.templateData && (
                        <div>
                          <h3 className="font-semibold mb-2">Template Configuration</h3>
                          <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
                            <pre className="text-xs">
                              {JSON.stringify(template.templateData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {/* Metadata */}
                      <div>
                        <h3 className="font-semibold mb-2">Metadata</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <span className="ml-2">
                              {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Updated:</span>
                            <span className="ml-2">
                              {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className="ml-2">{template.templateType}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Complexity:</span>
                            <span className="ml-2">{template.complexity || 'Not specified'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </div>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-0">
          <Separator className="mb-6" />
          <div className="flex justify-end">
            {/* Primary Actions */}
            <div className="flex space-x-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {onUse && (
                <Button onClick={() => onUse(template)}>
                  <Play className="w-4 h-4 mr-2" />
                  Use This Template
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
