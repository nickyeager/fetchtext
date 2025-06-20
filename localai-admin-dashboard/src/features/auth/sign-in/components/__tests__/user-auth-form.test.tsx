import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { UserAuthForm } from '../user-auth-form'

vi.mock('@tanstack/react-router', () => {
  const mockNavigate = vi.fn()
  return {
    Link: (props: Record<string, unknown>) => createElement('a', props),
    useRouter: () => ({ history: { location: { href: '/' } } }),
    useNavigate: () => mockNavigate,
    useSearch: () => ({ redirect: '/' }),
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      auth: {
        signInWithPassword: vi.fn(),
      },
    },
  }
})

describe('UserAuthForm', () => {
  let mockNavigate: any
  let mockSignInWithPassword: any
  let mockToastSuccess: any
  let mockToastError: any

  beforeEach(async () => {
    const routerModule = await import('@tanstack/react-router')
    const sonnerModule = await import('sonner')
    const supabaseModule = await import('@/lib/supabase')

    mockNavigate = routerModule.useNavigate()
    mockToastSuccess = vi.mocked(sonnerModule.toast.success)
    mockToastError = vi.mocked(sonnerModule.toast.error)
    mockSignInWithPassword = vi.mocked(supabaseModule.supabase.auth.signInWithPassword)

    vi.clearAllMocks()
    // Clear DOM before each test to avoid multiple element issues
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders email and password fields', () => {
    const { container } = render(<UserAuthForm />)

    expect(container.querySelector('input[name="email"]')).toBeInTheDocument()
    expect(container.querySelector('input[name="password"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('shows validation errors for invalid inputs', async () => {
    render(<UserAuthForm />)

    const submitButton = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/please enter your email/i)).toBeInTheDocument()
      expect(screen.getByText(/please enter your password/i)).toBeInTheDocument()
    })
  })

  it('shows error for invalid email format', async () => {
    render(<UserAuthForm />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'invalid-email' },
    })
    
    const submitButton = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it('shows error for short password', async () => {
    render(<UserAuthForm />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: '123' },
    })
    
    const submitButton = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 7 characters long/i)).toBeInTheDocument()
    })
  })

  it('calls supabase.signInWithPassword on successful submit', async () => {
    mockSignInWithPassword.mockResolvedValue({ 
      data: { user: { id: 'user-123', email: 'test@example.com' } }, 
      error: null 
    })

    render(<UserAuthForm />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })

  it('shows success message and navigates on successful login', async () => {
    mockSignInWithPassword.mockResolvedValue({ 
      data: { user: { id: 'user-123', email: 'test@example.com' } }, 
      error: null 
    })

    render(<UserAuthForm />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Successfully logged in!')
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('shows error message on failed login', async () => {
    const errorMessage = 'Invalid credentials'
    mockSignInWithPassword.mockResolvedValue({ 
      data: {}, 
      error: { message: errorMessage } 
    })

    render(<UserAuthForm />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    })

    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Login failed: ' + errorMessage)
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })
})