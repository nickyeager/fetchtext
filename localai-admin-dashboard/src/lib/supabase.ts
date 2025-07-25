import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('[Supabase] Missing URL or Anon key in environment variables')
}

// Debug: Log configuration for verification
// eslint-disable-next-line no-console
console.log('[Supabase Debug] URL:', supabaseUrl)
// eslint-disable-next-line no-console  
console.log('[Supabase Debug] Anon Key (first 20 chars):', supabaseAnonKey?.substring(0, 20) + '...')

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 