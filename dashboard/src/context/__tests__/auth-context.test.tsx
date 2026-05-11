import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../auth-context'
import type { Session, User } from '@supabase/supabase-js'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

function TestComponent() {
  const { session, user } = useAuth()
  return (
    <div>
      <span data-testid='session'>{session ? 'authenticated' : 'not-authenticated'}</span>
      <span data-testid='user'>{user ? user.email : 'no-user'}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  let mockGetSession: any
  let mockOnAuthStateChange: any
  let mockUnsubscribe: any

  beforeEach(async () => {
    const { supabase } = await import('@/lib/supabase')
    mockGetSession = vi.mocked(supabase.auth.getSession)
    mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange)
    mockUnsubscribe = vi.fn()

    vi.clearAllMocks()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    })
  })

  it('provides null session and user by default', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('session').textContent).toBe('not-authenticated')
      expect(screen.getByTestId('user').textContent).toBe('no-user')
    })
  })

  it('provides session and user when authenticated', async () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: '2023-01-01T00:00:00Z',
      phone: '',
      confirmed_at: '2023-01-01T00:00:00Z',
      last_sign_in_at: '2023-01-01T00:00:00Z',
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    }

    const mockSession: Session = {
      access_token: 'access-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Date.now() / 1000 + 3600,
      refresh_token: 'refresh-token',
      user: mockUser,
    }

    mockGetSession.mockResolvedValue({ data: { session: mockSession } })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('session').textContent).toBe('authenticated')
      expect(screen.getByTestId('user').textContent).toBe('test@example.com')
    })
  })

  it('calls supabase auth methods on initialization', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(1)
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
    })
  })

  it('unsubscribes from auth changes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
    })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
}) 