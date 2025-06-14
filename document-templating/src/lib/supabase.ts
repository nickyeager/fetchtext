import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your_anon_key_here'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Database types
export interface Document {
  id: number
  uuid: string
  name: string
  file_path: string
  file_type: string
  file_size: number
  content_text: string | null
  metadata: Record<string, any>
  uploaded_by: string
  created_at: string
  updated_at: string
}

export interface Template {
  id: number
  uuid: string
  name: string
  description: string | null
  template_content: string
  template_type: string
  variables: any[]
  is_public: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface GeneratedOutput {
  id: number
  uuid: string
  document_id: number
  template_id: number
  generated_content: string
  generation_settings: Record<string, any>
  status: string
  created_by: string
  created_at: string
}

export interface CollaborationEvent {
  id: number
  template_id: number
  user_id: string
  event_type: 'cursor_move' | 'text_edit' | 'selection_change'
  event_data: Record<string, any>
  timestamp: string
}

export interface ProcessingJob {
  id: number
  document_id: number
  template_id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error_message: string | null
  processing_settings: Record<string, any>
  created_by: string
  created_at: string
  updated_at: string
}
