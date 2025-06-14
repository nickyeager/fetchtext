import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type Document, type Template, type GeneratedOutput } from './data/schema'
import DocumentUpload from './components/DocumentUpload'
import TemplateEditor from './components/TemplateEditor'
import { FileText, Layout, Eye, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DocumentsFeature() {
  const [user, setUser] = useState<unknown>(null)
  const [activeTab, setActiveTab] = useState<'documents' | 'templates' | 'outputs'>('documents')
  const [documents, setDocuments] = useState<Document[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([])
  const [_selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [_selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
      setupRealtimeSubscriptions()
    }
  }, [user])

  const loadData = async () => {
    try {
      // Load documents
      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (docsData) setDocuments(docsData)

      // Load templates
      const { data: templatesData } = await supabase
        .from('templates')
        .select('*')
        .or(`created_by.eq.${user?.id},is_public.eq.true`)
        .order('created_at', { ascending: false })
      
      if (templatesData) setTemplates(templatesData)

      // Load outputs
      const { data: outputsData } = await supabase
        .from('generated_outputs')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (outputsData) setOutputs(outputsData)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading data:', error)
    }
  }

  const setupRealtimeSubscriptions = () => {
    // Subscribe to documents changes
    const documentsSubscription = supabase
      .channel('documents')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'documents' },
        (payload) => {
          // eslint-disable-next-line no-console
          console.log('Document change:', payload)
          loadData() // Refresh data on changes
        }
      )
      .subscribe()

    // Subscribe to templates changes
    const templatesSubscription = supabase
      .channel('templates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'templates' },
        (payload) => {
          // eslint-disable-next-line no-console
          console.log('Template change:', payload)
          loadData()
        }
      )
      .subscribe()

    // Subscribe to outputs changes
    const outputsSubscription = supabase
      .channel('outputs')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'generated_outputs' },
        (payload) => {
          // eslint-disable-next-line no-console
          console.log('Output change:', payload)
          loadData()
        }
      )
      .subscribe()

    return () => {
      documentsSubscription.unsubscribe()
      templatesSubscription.unsubscribe()
      outputsSubscription.unsubscribe()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium">Authentication Required</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please sign in to access document management features.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Document Management</h1>
        <p className="text-muted-foreground">
          Upload documents, create templates, and generate content using AI.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documents" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Documents</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center space-x-2">
            <Layout className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="outputs" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>Generated Content</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          <DocumentUpload
            documents={documents}
            onDocumentSelect={setSelectedDocument}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplateEditor
            templates={templates}
            onTemplateSelect={setSelectedTemplate}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="outputs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
              <CardDescription>
                View and manage AI-generated content from your templates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {outputs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No generated content yet. Create templates and generate content to see results here.
                </div>
              ) : (
                <div className="space-y-4">
                  {outputs.map((output) => (
                    <div
                      key={output.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Generated Content #{output.id}</p>
                          <p className="text-sm text-muted-foreground">
                            Status: {output.status} • {new Date(output.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-2">
                        <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                          {output.generated_content.substring(0, 200)}
                          {output.generated_content.length > 200 && '...'}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 