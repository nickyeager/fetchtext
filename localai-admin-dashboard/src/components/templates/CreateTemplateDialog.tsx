import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { TemplateService } from '@/lib/template-service'
import { supabase } from '@/lib/supabase'

interface CreateTemplateDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface TemplateCategory {
  id: string
  name: string
  description: string
  icon?: string
}

export function CreateTemplateDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateTemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    templateType: 'n8n' as 'n8n' | 'flowise' | 'hybrid' | 'other',
    complexity: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    estimatedTimeMinutes: 30,
    tags: [] as string[],
    templateData: '',
    thumbnailUrl: '',
  })
  
  const [newTag, setNewTag] = useState('')

  // Load categories on component mount
  useEffect(() => {
    if (isOpen) {
      loadCategories()
    }
  }, [isOpen])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('template_categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
      toast.error('Failed to load categories')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.description.trim() || !formData.categoryId) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setIsLoading(true)

      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.categoryId,
        templateType: formData.templateType,
        complexity: formData.complexity,
        estimatedTimeMinutes: formData.estimatedTimeMinutes,
        tags: formData.tags,
        templateData: formData.templateData ? JSON.parse(formData.templateData) : {},
        thumbnailUrl: formData.thumbnailUrl || undefined,
      }

      await TemplateService.createTemplate(templateData)
      
      toast.success('Template created successfully!')
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error('Failed to create template. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      templateType: 'n8n',
      complexity: 'beginner',
      estimatedTimeMinutes: 30,
      tags: [],
      templateData: '',
      thumbnailUrl: '',
    })
    setNewTag('')
    onClose()
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
          <DialogDescription>
            Create a reusable workflow template that others can use and customize.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Email Marketing Automation"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what this template does and how it can be used..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[100px]"
                required
              />
            </div>
          </div>

          {/* Template Configuration */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="templateType">Template Type</Label>
                <Select
                  value={formData.templateType}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, templateType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="n8n">n8n</SelectItem>
                    <SelectItem value="flowise">Flowise</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="complexity">Complexity</Label>
                <Select
                  value={formData.complexity}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, complexity: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedTime">Est. Time (min)</Label>
                <Input
                  id="estimatedTime"
                  type="number"
                  min="1"
                  value={formData.estimatedTimeMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedTimeMinutes: parseInt(e.target.value) || 30 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnailUrl">Thumbnail URL (optional)</Label>
              <Input
                id="thumbnailUrl"
                placeholder="https://example.com/image.jpg"
                value={formData.thumbnailUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-2 py-1">
                  {tag}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1 hover:bg-transparent"
                    onClick={() => removeTag(tag)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag (e.g., automation, email, crm)"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Template Data */}
          <div className="space-y-2">
            <Label htmlFor="templateData">Template Data (JSON)</Label>
            <Textarea
              id="templateData"
              placeholder='{"nodes": [], "connections": []} - Optional workflow definition'
              value={formData.templateData}
              onChange={(e) => setFormData(prev => ({ ...prev, templateData: e.target.value }))}
              className="min-h-[120px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Optional: Paste your workflow JSON here (n8n workflow export, Flowise flow, etc.)
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
