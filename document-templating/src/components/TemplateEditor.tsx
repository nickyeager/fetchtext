import React, { useState, useEffect, useRef } from 'react'
import { supabase, type Template, type CollaborationEvent } from '../lib/supabase'
import { Plus, Edit3, Save, Eye, Users, Trash2, Copy } from 'lucide-react'

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
    console.log('Collaboration event:', event)
    // Handle real-time collaboration events here
    // This would update cursor positions, selections, etc.
  }

  const sendCollaborationEvent = async (eventType: string, eventData: any) => {
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

      const { data, error } = await supabase
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
      console.error('Error saving template:', error)
      alert('Error saving template')
    }
  }

  const deleteTemplate = async (template: Template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return

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
      console.error('Error duplicating template:', error)
      alert('Error duplicating template')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Templates List */}
      <div className="lg:col-span-1">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Templates
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {templates.length} template{templates.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="divide-y divide-gray-200">
            {templates.map((template) => (
              <li key={template.id}>
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <button
                        onClick={() => {
                          setSelectedTemplate(template)
                          setIsEditing(false)
                          onTemplateSelect(template)
                        }}
                        className="text-left w-full"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {template.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {template.template_type}
                          {template.is_public && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Public
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          Updated {new Date(template.updated_at).toLocaleDateString()}
                        </p>
                      </button>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => duplicateTemplate(template)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {templates.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500">
              No templates yet. Create your first template.
            </div>
          )}
        </div>
      </div>

      {/* Template Editor */}
      <div className="lg:col-span-2">
        {isCreating ? (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Create New Template
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Template Name
                  </label>
                  <input
                    type="text"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <input
                    type="text"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Template Type
                  </label>
                  <select
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={newTemplate.template_type}
                    onChange={(e) => setNewTemplate({ ...newTemplate, template_type: e.target.value })}
                  >
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                    <option value="latex">LaTeX</option>
                    <option value="plain">Plain Text</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Template Content
                  </label>
                  <textarea
                    rows={10}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={newTemplate.template_content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, template_content: e.target.value })}
                    placeholder="Enter your template content here. Use {{variable_name}} for placeholders."
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={newTemplate.is_public}
                    onChange={(e) => setNewTemplate({ ...newTemplate, is_public: e.target.checked })}
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Make this template public
                  </label>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createTemplate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Create Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedTemplate ? (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {selectedTemplate.name}
                  </h3>
                  {collaborators.length > 0 && (
                    <div className="flex items-center mt-1">
                      <Users className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-500">
                        {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  {isEditing ? (
                    <button
                      onClick={saveTemplate}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Template Name
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      value={selectedTemplate.name}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Template Content
                    </label>
                    <textarea
                      ref={editorRef}
                      rows={15}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
                      value={selectedTemplate.template_content}
                      onChange={(e) => handleTextChange(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Template Preview</h4>
                    <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-auto max-h-96 border">
                      {selectedTemplate.template_content}
                    </pre>
                  </div>
                  {selectedTemplate.description && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Description</h4>
                      <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6 text-center">
              <Eye className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No template selected
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Select a template from the list to view and edit it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
