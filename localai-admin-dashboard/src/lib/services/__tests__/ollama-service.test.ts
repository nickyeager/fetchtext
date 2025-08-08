/**
 * Tests for Ollama service
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ollamaService } from '../ollama-service'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('OllamaService', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAvailableModels', () => {
    it('should fetch available models successfully', async () => {
      const mockResponse = {
        models: [
          {
            name: 'qwen2.5:7b-instruct-q4_K_M',
            size: '4200000000',
            modified: '2024-01-15T10:30:00Z',
            digest: 'sha256:abc123'
          },
          {
            name: 'llama2:7b',
            size: '3800000000',
            modified: '2024-01-10T08:15:00Z',
            digest: 'sha256:def456'
          }
        ],
        current_model: 'qwen2.5:7b-instruct-q4_K_M'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await ollamaService.getAvailableModels()

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8090/models/')
      expect(result).toEqual(mockResponse)
    })

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503
      })

      await expect(ollamaService.getAvailableModels()).rejects.toThrow(
        'Failed to fetch available models'
      )
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(ollamaService.getAvailableModels()).rejects.toThrow(
        'Failed to fetch available models'
      )
    })
  })

  describe('setActiveModel', () => {
    it('should set active model successfully', async () => {
      const mockResponse = {
        status: 'success',
        message: 'Active model set to llama2:7b',
        model: 'llama2:7b'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await ollamaService.setActiveModel('llama2:7b')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8090/models/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_name: 'llama2:7b' }),
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle API errors with details', async () => {
      const errorResponse = {
        detail: 'Model not found in available models'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse
      })

      await expect(ollamaService.setActiveModel('invalid:model')).rejects.toThrow(
        'Model not found in available models'
      )
    })

    it('should handle API errors without details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      })

      await expect(ollamaService.setActiveModel('some:model')).rejects.toThrow(
        'HTTP error! status: 500'
      )
    })
  })

  describe('getCurrentModel', () => {
    it('should get current model successfully', async () => {
      const mockResponse = {
        current_model: 'qwen2.5:7b-instruct-q4_K_M'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await ollamaService.getCurrentModel()

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8090/models/current')
      expect(result).toEqual(mockResponse)
    })

    it('should handle errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(ollamaService.getCurrentModel()).rejects.toThrow(
        'Failed to get current model'
      )
    })
  })

  describe('utility methods', () => {
    it('should format model size correctly', () => {
      expect(ollamaService.formatModelSize('1024')).toBe('1.0 KB')
      expect(ollamaService.formatModelSize('1048576')).toBe('1.0 MB')
      expect(ollamaService.formatModelSize('1073741824')).toBe('1.0 GB')
      expect(ollamaService.formatModelSize('4200000000')).toBe('3.9 GB')
      expect(ollamaService.formatModelSize('Unknown')).toBe('Unknown')
      expect(ollamaService.formatModelSize('')).toBe('Unknown')
    })

    it('should format model name correctly', () => {
      expect(ollamaService.formatModelName('qwen2.5:7b-instruct-q4_K_M')).toBe('qwen2.5')
      expect(ollamaService.formatModelName('llama2:latest')).toBe('llama2')
      expect(ollamaService.formatModelName('simple-model')).toBe('simple-model')
    })

    it('should get model display name correctly', () => {
      const model1 = {
        name: 'qwen2.5:7b-instruct-q4_K_M',
        size: '4200000000',
        modified: '2024-01-15T10:30:00Z',
        digest: 'sha256:abc123'
      }

      const model2 = {
        name: 'simple-model',
        size: '2000000000',
        modified: '2024-01-10T08:15:00Z',
        digest: 'sha256:def456'
      }

      expect(ollamaService.getModelDisplayName(model1)).toBe('qwen2.5 (7b-instruct-q4_K_M)')
      expect(ollamaService.getModelDisplayName(model2)).toBe('simple-model')
    })
  })
})