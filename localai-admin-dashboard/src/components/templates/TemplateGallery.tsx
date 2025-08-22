import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, SlidersHorizontal, Grid3X3, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TemplateCard } from './TemplateCard'
import { SmartTemplateEditor } from './SmartTemplateEditor'
import { WorkflowTemplate, TemplateCategory, TemplateFilters } from '@/types/workflows'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { SmartVariable } from '@/lib/template-validator'

interface TemplateGalleryProps {
  onCreateTemplate?: () => void
  onPreviewTemplate?: (template: WorkflowTemplate) => void
  onUseTemplate?: (template: WorkflowTemplate) => void
  onRefresh?: (refreshFn: () => Promise<void>) => void
  className?: string
}

export function TemplateGallery({
  onCreateTemplate,
  onPreviewTemplate,
  onUseTemplate,
  onRefresh,
  className,
}: TemplateGalleryProps) {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  
  const [filters, setFilters] = useState<TemplateFilters>({
    complexity: undefined,
    templateType: undefined,
    tags: [],
  })

  // Load templates and categories
  const loadTemplatesAndCategories = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('template_categories')
        .select('*')
        .order('name')

      if (categoriesError) throw categoriesError

      // Load templates with category information
      const { data: templatesData, error: templatesError } = await supabase
        .from('workflow_templates')
        .select(`
          *,
          category:template_categories(id, name, description, icon)
        `)
        .order('created_at', { ascending: false })

      if (templatesError) throw templatesError

      setCategories(categoriesData || [])
      setTemplates(templatesData?.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category?.name,
        tags: template.tags || [],
        thumbnailUrl: template.thumbnail_url,
        complexity: template.difficulty_level as 'beginner' | 'intermediate' | 'advanced',
        estimatedTimeMinutes: template.estimated_time_minutes,
        templateType: template.template_type as 'n8n' | 'flowise' | 'hybrid' | 'other',
        n8nWorkflowId: template.n8n_workflow_id,
        flowiseFlowId: template.flowise_flow_id,
        templateData: template.template_data,
        usageCount: template.usage_count,
        createdBy: template.created_by,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      })) || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplatesAndCategories()
  }, [loadTemplatesAndCategories])

  // Provide refresh function to parent through callback
  useEffect(() => {
    if (onRefresh) {
      onRefresh(loadTemplatesAndCategories);
    }
  }, [onRefresh, loadTemplatesAndCategories])

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = templates

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory)
    }

    // Apply other filters
    if (filters.complexity) {
      filtered = filtered.filter(template => template.complexity === filters.complexity)
    }

    if (filters.templateType) {
      filtered = filtered.filter(template => template.templateType === filters.templateType)
    }


    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(template =>
        filters.tags!.some(filterTag =>
          template.tags?.some(templateTag => templateTag.toLowerCase().includes(filterTag.toLowerCase()))
        )
      )
    }

    // Sort templates
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'created_at':
          aValue = new Date(a.createdAt || 0)
          bValue = new Date(b.createdAt || 0)
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [templates, searchQuery, selectedCategory, filters, sortBy, sortOrder])

  const handleTemplateAction = async (action: string, template: WorkflowTemplate) => {
    switch (action) {
      case 'preview':
        onPreviewTemplate?.(template)
        break
      case 'use':
        onUseTemplate?.(template)
        // Increment usage count
        // Usage tracking removed
        break
      case 'edit':
        // Handle edit - open the editor dialog
        console.log('Editing template:', template)
        setEditingTemplate(template)
        break
      case 'duplicate':
        // Handle duplication
        break
      case 'delete':
        // Handle deletion with confirmation
        break
    }
  }

  const clearFilters = () => {
    setFilters({
      complexity: undefined,
      templateType: undefined,
      tags: [],
      })
    setSelectedCategory('all')
    setSearchQuery('')
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.complexity) count++
    if (filters.templateType) count++
    if (filters.tags && filters.tags.length > 0) count++
    if (selectedCategory !== 'all') count++
    return count
  }, [filters, selectedCategory])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="flex space-x-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflow Templates</h1>
          <p className="text-muted-foreground">
            Discover and use pre-built workflow templates to accelerate your automation projects.
          </p>
        </div>
        {onCreateTemplate && (
          <Button onClick={onCreateTemplate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search templates by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.name}>
                <div className="flex items-center space-x-2">
                  {category.icon && <span>{category.icon}</span>}
                  <span>{category.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
          const [field, order] = value.split('-')
          setSortBy(field as any)
          setSortOrder(order as 'asc' | 'desc')
        }}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="created_at-desc">Newest</SelectItem>
            <SelectItem value="created_at-asc">Oldest</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Filters */}
        <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Templates</SheetTitle>
              <SheetDescription>
                Narrow down templates by complexity, type, and other criteria.
              </SheetDescription>
            </SheetHeader>
            
            <div className="space-y-6 mt-6">
              {/* Complexity Filter */}
              <div>
                <Label className="text-sm font-medium">Complexity</Label>
                <Select
                  value={filters.complexity || 'all'}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      complexity: value === 'all' ? undefined : (value as 'beginner' | 'intermediate' | 'advanced')
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any complexity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any complexity</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Type Filter */}
              <div>
                <Label className="text-sm font-medium">Template Type</Label>
                <Select
                  value={filters.templateType || 'all'}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      templateType: value === 'all' ? undefined : (value as 'n8n' | 'flowise' | 'hybrid' | 'other')
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any type</SelectItem>
                    <SelectItem value="n8n">N8N</SelectItem>
                    <SelectItem value="flowise">Flowise</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>


              <Separator />

              {/* Clear Filters */}
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear All Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* View Mode Toggle */}
        <div className="flex border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="px-3"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="px-3"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredAndSortedTemplates.length} template{filteredAndSortedTemplates.length !== 1 ? 's' : ''} found
        </p>
        
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Templates Grid */}
      {filteredAndSortedTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No templates found
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your search criteria or filters
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            'gap-6',
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'flex flex-col space-y-4'
          )}
        >
          {filteredAndSortedTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => handleTemplateAction('preview', template)}
              onUse={() => handleTemplateAction('use', template)}
              onEdit={() => handleTemplateAction('edit', template)}
              onDuplicate={() => handleTemplateAction('duplicate', template)}
              onDelete={() => handleTemplateAction('delete', template)}
              isOwner={user?.id === template.createdBy}
              className={viewMode === 'list' ? 'flex-row h-32' : ''}
            />
          ))}
        </div>
      )}

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <EditTemplateWrapper 
              editingTemplate={editingTemplate}
              user={user}
              onSave={async (updatedTemplate) => {
                try {
                  // Update the template in the database
                  const currentTemplateData = (typeof editingTemplate.templateData === 'object' && editingTemplate.templateData) || {}
                  const templateData = {
                    ...currentTemplateData,
                    content: updatedTemplate.template_content,
                    variables: updatedTemplate.smart_variables,
                    extraction_rules: updatedTemplate.extraction_rules,
                    generation_settings: updatedTemplate.generation_settings
                  }

                  const { error } = await supabase
                    .from('workflow_templates')
                    .update({
                      name: updatedTemplate.name,
                      description: updatedTemplate.description,
                      template_data: templateData,
                      category: updatedTemplate.category,
                      tags: updatedTemplate.tags,
                      thumbnail_url: updatedTemplate.thumbnail_url,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', editingTemplate.id)
                    .eq('created_by', user?.id) // Ensure user can only update their own templates

                  if (error) {
                    console.error('Failed to update template:', error)
                    console.error('Error details:', JSON.stringify(error, null, 2))
                    toast.error(`Failed to update template: ${error.message}`)
                    throw error
                  }

                  toast.success('Template updated successfully')
                  setEditingTemplate(null)
                  // Refresh the templates list
                  loadTemplatesAndCategories()
                } catch (error) {
                  console.error('Error updating template:', error)
                  toast.error('An error occurred while updating the template')
                }
              }}
              onCancel={() => setEditingTemplate(null)}
              loadTemplatesAndCategories={loadTemplatesAndCategories}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Memoized wrapper component to prevent infinite re-renders
const EditTemplateWrapper = React.memo(function EditTemplateWrapper({
  editingTemplate,
  user,
  onSave,
  onCancel,
  loadTemplatesAndCategories
}: {
  editingTemplate: WorkflowTemplate
  user: any
  onSave: (updatedTemplate: any) => Promise<void>
  onCancel: () => void
  loadTemplatesAndCategories: () => Promise<void>
}) {
  // Memoize the template object to prevent recreation on every render
  const memoizedTemplate = React.useMemo(() => ({
    id: parseInt(editingTemplate.id),
    uuid: editingTemplate.id,
    name: editingTemplate.name,
    description: editingTemplate.description || '',
    template_content: (typeof editingTemplate.templateData === 'object' && editingTemplate.templateData?.content) || editingTemplate.name || '',
    template_type: 'markdown',
    smart_variables: (typeof editingTemplate.templateData === 'object' && Array.isArray(editingTemplate.templateData?.variables)) 
      ? editingTemplate.templateData.variables as SmartVariable[]
      : [],
    extraction_rules: (typeof editingTemplate.templateData === 'object' && Array.isArray(editingTemplate.templateData?.extraction_rules)) 
      ? editingTemplate.templateData.extraction_rules 
      : [],
    generation_settings: (typeof editingTemplate.templateData === 'object' && editingTemplate.templateData?.generation_settings) 
      ? editingTemplate.templateData.generation_settings 
      : {},
    category: editingTemplate.category || 'Other',
    tags: editingTemplate.tags || [],
    is_public: true,
    usage_count: 0,
    rating: 0,
    thumbnail_url: editingTemplate.thumbnailUrl,
    created_by: editingTemplate.createdBy,
    created_at: editingTemplate.createdAt,
    updated_at: editingTemplate.updatedAt
  }), [editingTemplate])

  return (
    <SmartTemplateEditor
      template={memoizedTemplate}
      onSave={onSave}
      onCancel={onCancel}
      isNew={false}
    />
  )
})
