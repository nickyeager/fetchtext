import { describe, it, expect } from 'vitest'
import { getUserFriendlyAuthError } from '@/lib/auth-error-messages'

describe('getUserFriendlyAuthError', () => {
  it('translates empty JSON response error to service unavailable message', () => {
    // This is the exact error Supabase auth-js throws when the backend
    // returns HTTP 500 with an empty body (e.g. Vite proxy to dead Docker)
    const rawError = "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
    const result = getUserFriendlyAuthError(rawError)
    expect(result).toBe('Authentication service is unavailable. Please ensure backend services are running.')
    expect(result).not.toContain('json')
    expect(result).not.toContain('JSON')
  })

  it('translates network fetch failure to connection error message', () => {
    const result = getUserFriendlyAuthError('Failed to fetch')
    expect(result).toBe('Cannot reach the authentication service. Please check your connection.')
  })

  it('translates AbortError to connection error message', () => {
    const result = getUserFriendlyAuthError('AbortError: The operation was aborted')
    expect(result).toBe('Cannot reach the authentication service. Please check your connection.')
  })

  it('passes through normal Supabase auth errors unchanged', () => {
    expect(getUserFriendlyAuthError('Invalid login credentials'))
      .toBe('Invalid login credentials')
  })

  it('passes through weak password errors unchanged', () => {
    expect(getUserFriendlyAuthError('Password should be at least 6 characters'))
      .toBe('Password should be at least 6 characters')
  })

  it('passes through email already registered error unchanged', () => {
    expect(getUserFriendlyAuthError('User already registered'))
      .toBe('User already registered')
  })
})
