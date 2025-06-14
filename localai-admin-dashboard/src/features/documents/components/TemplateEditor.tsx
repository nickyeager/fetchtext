import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { type Template, type CollaborationEvent } from '../data/schema'
import { Plus, Edit3, Save, Eye, Users, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface TemplateEditorProps {
  templates: Template[]
  onTemplateSelect: (template: Template) => void
  onRefresh: () => void
}

export default function TemplateEditor({ templates, onTemplateSelect, onRefresh }: TemplateEditorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    template_content: '',
    template_type: 'markdown',
    is_public: false
  })
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (selectedTemplate) {
      setupCollaboration()
    }
  }, [selectedTemplate])

  const setupCollaboration = () => {
    if (!selectedTemplate) return

    // Subscribe to collaboration events for this template
    const collaborationChannel = supabase
      .channel(`template-${selectedTemplate.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'template_collaboration_events',
          filter: `template_id=eq.${selectedTemplate.id}`
        },
        (payload) => {
          handleCollaborationEvent(payload.new as CollaborationEvent)
        }
      )
      .on('broadcast',
        { event: 'cursor-move' },
        (payload) => {
          // eslint-disable-next-line no-console
          console.log('Cursor move:', payload)
        }
      )
      .on('presence',
        { event: 'sync' },
        () => {
          const presenceState = collaborationChannel.presenceState()
          const users = Object.keys(presenceState)
          setCollaborators(users)
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const user = await supabase.auth.getUser()
          if (user.data.user) {
            await collaborationChannel.track({
              user_id: user.data.user.id,
              user_email: user.data.user.email,
              online_at: new Date().toISOString(),
            })
          }
        }
      })

    return () => {
      collaborationChannel.unsubscribe()
    }
  }

  const handleCollaborationEvent = (event: CollaborationEvent) => {
    // eslint-disable-next-line no-console
    console.log('Collaboration event:', event)
    // Handle real-time collaboration events here
    // This would update cursor positions, selections, etc.
  }

  const sendCollaborationEvent = async (eventType: string, eventData: Record<string, unknown>) => {
    if (!selectedTemplate) return

    const user = await supabase.auth.getUser()
    if (!user.data.user) return

    await supabase
      .from('template_collaboration_events')
      .insert({
        template_id: selectedTemplate.id,
        user_id: user.data.user.id,
        event_type: eventType,
        event_data: eventData
      })
  }

  const handleTextChange = (content: string) => {
    if (selectedTemplate) {
      setSelectedTemplate({ ...selectedTemplate, template_content: content })
      
      // Send collaboration event
      sendCollaborationEvent('text_edit', {
        position: editorRef.current?.selectionStart || 0,
        length: content.length,
        timestamp: Date.now()
      })
    }
  }

  const createTemplate = async () => {
    try {
      const user = await supabase.auth.getUser()
      if (!user.data.user) throw new Error('No user found')

      const { error } = await supabase
        .from('templates')
        .insert({
          ...newTemplate,
          created_by: user.data.user.id
        })
        .select()

      if (error) throw error

      setIsCreating(false)
      setNewTemplate({
        name: '',
        description: '',
        template_content: '',
        template_type: 'markdown',
        is_public: false
      })
      onRefresh()
      alert('Template created successfully!')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating template:', error)
      alert('Error creating template')
    }
  }

  const saveTemplate = async () => {
    if (!selectedTemplate) return

    try {
      const { error } = await supabase
        .from('templates')
        .update({
          name: selectedTemplate.name,
          description: selectedTemplate.description,
          template_content: selectedTemplate.template_content,
          template_type: selectedTemplate.template_type,
          is_public: selectedTemplate.is_public
        })
        .eq('id', selectedTemplate.id)

      if (error) throw error

      setIsEditing(false)
      onRefresh()
      alert('Template saved successfully!')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error saving template:', error)
      alert('Error saving template')
    }
  }

  const deleteTemplate = async (template: Template) => {
    try {
      await supabase
        .from('templates')
        .delete()
        .eq('id', template.id)

      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null)
      }
      onRefresh()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error deleting template:', error)
      alert('Error deleting template')
    }
  }

  const duplicateTemplate = async (template: Template) => {
    try {
      const user = await supabase.auth.getUser()
      if (!user.data.user) throw new Error('No user found')

      await supabase
        .from('templates')
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          template_content: template.template_content,
          template_type: template.template_type,
          variables: template.variables,
          is_public: false,
          created_by: user.data.user.id
        })

      onRefresh()
      alert('Template duplicated successfully!')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error duplicating template:', error)
      alert('Error duplicating template')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Templates List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">Templates</CardTitle>
              <CardDescription>
                {templates.length} template{templates.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsCreating(true)}
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <button
                      onClick={() => {
                        setSelectedTemplate(template)
                        setIsEditing(false)
                        onTemplateSelect(template)
                      }}
                      className="text-left w-full"
                    >
                      <p className="font-medium">{template.name}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">{template.template_type}</Badge>
                        {template.is_public && (
                          <Badge variant="outline">Public</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(template.updated_at).toLocaleDateString()}
                      </p>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateTemplate(template)}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTemplate(template)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  No templates yet. Create your first template.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template Editor */}
      <div className="lg:col-span-2">
        {isCreating ? (
          <Card>
            <CardHeader>
              <CardTitle>Create New Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="template-type">Template Type</Label>
                <Select
                  value={newTemplate.template_type}
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, template_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="latex">LaTeX</SelectItem>
                    <SelectItem value="plain">Plain Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="template-content">Template Content</Label>
                <Textarea
                  id="template-content"
                  rows={10}
                  value={newTemplate.template_content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, template_content: e.target.value })}
                  placeholder="Enter your template content here. Use {{variable_name}} for placeholders."
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-public"
                  checked={newTemplate.is_public}
                  onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, is_public: checked as boolean })}
                />
                <Label htmlFor="is-public">Make this template public</Label>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button onClick={createTemplate}>
                  Create Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : selectedTemplate ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{selectedTemplate.name}</CardTitle>
                {collaborators.length > 0 && (
                  <div className="flex items-center mt-1">
                    <Users className="h-4 w-4 text-muted-foreground mr-1" />
                    <span className="text-sm text-muted-foreground">
                      {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                {isEditing ? (
                  <Button onClick={saveTemplate}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Template Name</Label>
                    <Input
                      id="edit-name"
                      value={selectedTemplate.name}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-content">Template Content</Label>
                    <Textarea
                      id="edit-content"
                      ref={editorRef}
                      rows={15}
                      className="font-mono"
                      value={selectedTemplate.template_content}
                      onChange={(e) => handleTextChange(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Template Preview</h4>
                    <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 border">
                      {selectedTemplate.template_content}
                    </pre>
                  </div>
                  {selectedTemplate.description && (
                    <div>
                      <h4 className="text-sm font-medium">Description</h4>
                      <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Eye className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No template selected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a template from the list to view and edit it.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 