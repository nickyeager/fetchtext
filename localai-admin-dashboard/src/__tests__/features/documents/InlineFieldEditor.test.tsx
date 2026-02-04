import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineFieldEditor } from '@/features/documents/components/InlineFieldEditor'

describe('InlineFieldEditor', () => {
  const defaultProps = {
    fieldName: 'invoice_amount',
    currentValue: '$1,500.00',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render input with current value', () => {
      render(<InlineFieldEditor {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('$1,500.00')
    })

    it('should render Save and Cancel buttons', () => {
      render(<InlineFieldEditor {...defaultProps} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should focus input on mount', () => {
      render(<InlineFieldEditor {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveFocus()
    })

    it('should select all text on mount', () => {
      render(<InlineFieldEditor {...defaultProps} />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe('$1,500.00'.length)
    })
  })

  describe('editing', () => {
    it('should update input value on typing', async () => {
      const user = userEvent.setup()
      render(<InlineFieldEditor {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '$1,750.00')

      expect(input).toHaveValue('$1,750.00')
    })

    it('should call onSave with new value when Save clicked', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<InlineFieldEditor {...defaultProps} onSave={onSave} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '$1,750.00')
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(onSave).toHaveBeenCalledWith('$1,750.00')
    })

    it('should call onSave when Enter pressed', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<InlineFieldEditor {...defaultProps} onSave={onSave} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '$1,750.00{Enter}')

      expect(onSave).toHaveBeenCalledWith('$1,750.00')
    })

    it('should call onCancel when Cancel clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<InlineFieldEditor {...defaultProps} onCancel={onCancel} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onCancel).toHaveBeenCalled()
    })

    it('should call onCancel when Escape pressed', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<InlineFieldEditor {...defaultProps} onCancel={onCancel} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '{Escape}')

      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should disable Save when value unchanged', async () => {
      render(<InlineFieldEditor {...defaultProps} />)

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })

    it('should enable Save when value changed', async () => {
      const user = userEvent.setup()
      render(<InlineFieldEditor {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '$1,750.00')

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).not.toBeDisabled()
    })

    it('should disable Save when value is empty', async () => {
      const user = userEvent.setup()
      render(<InlineFieldEditor {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })
  })

  describe('loading state', () => {
    it('should show loading indicator when saving', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn(() => new Promise(() => {})) // Never resolves
      render(<InlineFieldEditor {...defaultProps} onSave={onSave} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '$1,750.00')
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should disable input while saving', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn(() => new Promise(() => {}))
      render(<InlineFieldEditor {...defaultProps} onSave={onSave} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '$1,750.00')
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(input).toBeDisabled()
    })
  })

  describe('accessibility', () => {
    it('should have accessible label', () => {
      render(<InlineFieldEditor {...defaultProps} />)

      const input = screen.getByRole('textbox', { name: /edit invoice_amount/i })
      expect(input).toBeInTheDocument()
    })

    it('should announce saving state to screen readers', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn(() => new Promise(() => {}))
      render(<InlineFieldEditor {...defaultProps} onSave={onSave} />)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, '$1,750.00')
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(screen.getByRole('status')).toHaveTextContent(/saving/i)
    })
  })
})
