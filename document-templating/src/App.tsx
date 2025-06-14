import React, { useState, useEffect } from 'react'
import { supabase, type Document, type Template, type GeneratedOutput } from './lib/supabase'
import DocumentUpload from './components/DocumentUpload'
import TemplateEditor from './components/TemplateEditor'
import OutputViewer from './components/OutputViewer'
import { FileText, Layout, Eye, Plus, Upload } from 'lucide-react'

function App() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'documents' | 'templates' | 'outputs'>('documents')
  const [documents, setDocuments] = useState<Document[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Check your email for the confirmation link!')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Document Templating System
            </h2>
          </div>
          <AuthForm onSignIn={signInWithEmail} onSignUp={signUp} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Document Templating System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <button
                onClick={signOut}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Documents ({documents.length})
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layout className="w-4 h-4 inline mr-2" />
                Templates ({templates.length})
              </button>
              <button
                onClick={() => setActiveTab('outputs')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'outputs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-2" />
                Generated Outputs ({outputs.length})
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'documents' && (
            <DocumentUpload
              documents={documents}
              onDocumentSelect={setSelectedDocument}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'templates' && (
            <TemplateEditor
              templates={templates}
              onTemplateSelect={setSelectedTemplate}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'outputs' && (
            <OutputViewer
              outputs={outputs}
              documents={documents}
              templates={templates}
              onRefresh={loadData}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Simple auth form component
function AuthForm({ onSignIn, onSignUp }: {
  onSignIn: (email: string, password: string) => void
  onSignUp: (email: string, password: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignUp) {
      onSignUp(email, password)
    } else {
      onSignIn(email, password)
    }
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <input
            type="email"
            required
            className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <input
            type="password"
            required
            className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </div>

      <div className="text-center">
        <button
          type="button"
          className="text-blue-600 hover:text-blue-500"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </form>
  )
}

export default App
