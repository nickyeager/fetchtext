import { describe, it, expect } from 'vitest'
import { supabase } from '../supabase'

describe('Supabase client', () => {
  it('should create a client with auth module', () => {
    expect(supabase).toBeDefined()
    expect(typeof supabase.auth).toBe('object')
  })
}) 