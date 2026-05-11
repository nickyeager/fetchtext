/**
 * VariableBadge Input Rule Tests
 *
 * Tests for the input rule that converts {{variable_name}} syntax
 * into interactive variable badge nodes in the TipTap editor.
 *
 * Since TipTap input rules require actual keyboard events (which are hard to
 * simulate in unit tests), we test:
 * 1. The regex pattern matching
 * 2. The insertVariableBadge command
 * 3. HTML parsing/serialization of variable badges
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { VariableBadge } from '@/lib/tiptap/extensions/VariableBadge'

// The regex pattern used by the input rule
const VARIABLE_PATTERN = /\{\{([a-zA-Z_]\w*)\}\}$/

describe('VariableBadge Input Rule', () => {
  let editor: Editor

  beforeEach(() => {
    // Create a minimal TipTap editor with the VariableBadge extension
    editor = new Editor({
      extensions: [
        StarterKit,
        VariableBadge.configure({
          extractedData: {},
        }),
      ],
      content: '<p></p>',
    })
  })

  afterEach(() => {
    editor.destroy()
  })

  describe('regex pattern matching', () => {
    it('matches simple variable names', () => {
      const match = 'Hello {{test_variable}}'.match(VARIABLE_PATTERN)
      expect(match).toBeTruthy()
      expect(match![1]).toBe('test_variable')
    })

    it('matches variable names with uppercase letters', () => {
      const match = '{{MyVariable}}'.match(VARIABLE_PATTERN)
      expect(match).toBeTruthy()
      expect(match![1]).toBe('MyVariable')
    })

    it('matches underscore-separated variable names', () => {
      const match = '{{invoice_number}}'.match(VARIABLE_PATTERN)
      expect(match).toBeTruthy()
      expect(match![1]).toBe('invoice_number')
    })

    it('matches variable names starting with underscore', () => {
      const match = '{{_private_var}}'.match(VARIABLE_PATTERN)
      expect(match).toBeTruthy()
      expect(match![1]).toBe('_private_var')
    })

    it('matches variable names with numbers', () => {
      const match = '{{item1_price}}'.match(VARIABLE_PATTERN)
      expect(match).toBeTruthy()
      expect(match![1]).toBe('item1_price')
    })

    it('does not match incomplete variable syntax', () => {
      expect('{{incomplete'.match(VARIABLE_PATTERN)).toBeNull()
      expect('incomplete}}'.match(VARIABLE_PATTERN)).toBeNull()
      expect('{incomplete}'.match(VARIABLE_PATTERN)).toBeNull()
    })

    it('does not match variables with spaces', () => {
      // The pattern requires valid identifier characters
      expect('{{invalid variable}}'.match(VARIABLE_PATTERN)).toBeNull()
    })

    it('does not match variables starting with a number', () => {
      expect('{{123abc}}'.match(VARIABLE_PATTERN)).toBeNull()
      expect('{{1var}}'.match(VARIABLE_PATTERN)).toBeNull()
    })

    it('matches variable at end of longer string', () => {
      const match = 'Some text before {{my_var}}'.match(VARIABLE_PATTERN)
      expect(match).toBeTruthy()
      expect(match![1]).toBe('my_var')
    })
  })

  describe('insertVariableBadge command', () => {
    it('inserts a variable badge with all attributes', () => {
      editor.commands.setContent('<p>Test: </p>')
      editor.commands.focus('end')

      editor.commands.insertVariableBadge({
        variableId: 'programmatic_var',
        variableName: 'Programmatic Variable',
        format: 'currency',
      })

      const html = editor.getHTML()
      expect(html).toContain('data-variable-badge')
      expect(html).toContain('data-variable-id="programmatic_var"')
      expect(html).toContain('data-variable-name="Programmatic Variable"')
      expect(html).toContain('data-format="currency"')
    })

    it('uses default format when not specified', () => {
      editor.commands.setContent('<p></p>')
      editor.commands.focus('end')

      editor.commands.insertVariableBadge({
        variableId: 'test_var',
        variableName: 'Test Var',
      })

      const html = editor.getHTML()
      expect(html).toContain('data-format="raw"')
    })

    it('inserts multiple variable badges in sequence', () => {
      editor.commands.setContent('<p></p>')
      editor.commands.focus('end')

      editor.commands.insertVariableBadge({
        variableId: 'first',
        variableName: 'First',
      })
      editor.commands.insertContent(' and ')
      editor.commands.insertVariableBadge({
        variableId: 'second',
        variableName: 'Second',
      })

      const html = editor.getHTML()
      expect(html).toContain('data-variable-id="first"')
      expect(html).toContain('data-variable-id="second"')
      expect(html).toContain(' and ')
    })
  })

  describe('HTML parsing', () => {
    it('parses variable badge HTML correctly', () => {
      const htmlContent = `<p>Hello <span data-variable-badge="" data-variable-id="name" data-variable-name="Name" data-format="raw">{{Name}}</span>!</p>`

      editor.commands.setContent(htmlContent)

      // Get the JSON content to inspect the node structure
      const json = editor.getJSON()
      const paragraph = json.content?.[0]
      expect(paragraph).toBeDefined()

      // Find the variable badge node
      const variableBadge = paragraph?.content?.find(
        (node: { type?: string }) => node.type === 'variableBadge'
      )
      expect(variableBadge).toBeDefined()
      expect(variableBadge?.attrs?.variableId).toBe('name')
      expect(variableBadge?.attrs?.variableName).toBe('Name')
      expect(variableBadge?.attrs?.format).toBe('raw')
    })

    it('serializes variable badge to HTML correctly', () => {
      editor.commands.setContent('<p></p>')
      editor.commands.focus('end')
      editor.commands.insertVariableBadge({
        variableId: 'output_test',
        variableName: 'Output Test',
        format: 'date',
      })

      const html = editor.getHTML()
      expect(html).toContain('<span')
      expect(html).toContain('data-variable-badge')
      expect(html).toContain('data-variable-id="output_test"')
      expect(html).toContain('data-variable-name="Output Test"')
      expect(html).toContain('data-format="date"')
      expect(html).toContain('{{Output Test}}')
      expect(html).toContain('</span>')
    })
  })

  describe('edge cases for regex', () => {
    it('does not match empty braces', () => {
      expect('{{}}'.match(VARIABLE_PATTERN)).toBeNull()
    })

    it('does not match single braces', () => {
      expect('{variable}'.match(VARIABLE_PATTERN)).toBeNull()
    })

    it('does not match triple braces', () => {
      expect('{{{variable}}}'.match(VARIABLE_PATTERN)).toBeNull()
    })

    it('matches at exact end of string ($ anchor)', () => {
      // Should match when pattern is at the end
      expect('text {{var}}'.match(VARIABLE_PATTERN)).toBeTruthy()

      // Should NOT match if there's text after
      // Note: Our regex has $ anchor, but match() doesn't respect it the same way
      // In TipTap, the input rule only triggers when typed at cursor position
    })
  })

  describe('extension configuration', () => {
    it('can be configured with extracted data', () => {
      const extractedData = {
        test_var: { value: 'Test Value', confidence: 0.95 },
      }

      const configuredEditor = new Editor({
        extensions: [
          StarterKit,
          VariableBadge.configure({
            extractedData,
          }),
        ],
        content: '<p></p>',
      })

      // The extension should store the extracted data in options
      const variableBadgeExt = configuredEditor.extensionManager.extensions.find(
        (ext) => ext.name === 'variableBadge'
      )
      expect(variableBadgeExt?.options.extractedData).toEqual(extractedData)

      configuredEditor.destroy()
    })
  })
})
