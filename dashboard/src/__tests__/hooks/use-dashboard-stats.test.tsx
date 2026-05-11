/**
 * Dashboard Statistics Hook Tests
 *
 * Tests for the useDashboardStats hook that fetches real document
 * and template statistics from Supabase.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Create mock functions that will be shared
const mockGte = vi.fn()
const mockOrder = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

// Mock the auth utilities to bypass authentication
vi.mock('@/lib/supabase-auth-utils', () => ({
  withAuthentication: vi.fn(async (operation: (user: any) => Promise<any>) => {
    return operation({ id: 'test-user-id', email: 'test@example.com' })
  }),
  requireAuthentication: vi.fn(async () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    access_token: 'test-token',
  })),
}))

// Import after mocks are set up
import {
  useDashboardStats,
  type DashboardStats,
  type MonthlyDocumentData,
} from '@/hooks/use-dashboard-stats'

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

// Setup mocks for a successful response
function setupSuccessMocks(options: {
  documents?: any[]
  templateCount?: number
  templatesThisMonthCount?: number
}) {
  const {
    documents = [],
    templateCount = 0,
    templatesThisMonthCount = 0,
  } = options

  mockOrder.mockResolvedValue({ data: documents, error: null })
  mockGte.mockReturnValue({ order: mockOrder })

  mockSelect.mockImplementation((columns: string, opts?: any) => {
    // Template count queries (with head: true)
    if (opts?.head) {
      // Return a promise-like object that also has .gte for chained queries
      const countPromise = Promise.resolve({ count: templateCount, error: null })
      // Add gte method for templates this month query
      ;(countPromise as any).gte = vi.fn().mockResolvedValue({ count: templatesThisMonthCount, error: null })
      return countPromise
    }
    // Documents query
    if (columns.includes('processing_status')) {
      return Promise.resolve({ data: documents, error: null })
    }
    // Monthly documents query
    if (columns === 'id, created_at') {
      return { gte: mockGte }
    }
    return Promise.resolve({ data: [], error: null })
  })

  mockFrom.mockReturnValue({ select: mockSelect })
}

describe('useDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useDashboardStats hook', () => {
    it('should return initial loading state', () => {
      // Set up never-resolving mocks
      mockSelect.mockReturnValue(new Promise(() => {}))
      mockFrom.mockReturnValue({ select: mockSelect })

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.stats).toBeUndefined()
    })

    it('should fetch and calculate stats correctly', async () => {
      const testDocuments = [
        { id: 1, processing_status: 'completed', created_at: new Date().toISOString() },
        { id: 2, processing_status: 'completed', created_at: new Date().toISOString() },
        { id: 3, processing_status: 'failed', created_at: new Date().toISOString() },
        { id: 4, processing_status: 'processing', created_at: new Date().toISOString() },
        { id: 5, processing_status: 'analyzing', created_at: new Date().toISOString() },
      ]

      setupSuccessMocks({
        documents: testDocuments,
        templateCount: 10,
        templatesThisMonthCount: 2,
      })

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      })

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false)
        },
        { timeout: 5000 }
      )

      // Verify stats are calculated
      expect(result.current.stats).toBeDefined()
      expect(result.current.stats?.totalDocuments).toBe(5)
      expect(result.current.stats?.totalTemplates).toBe(10)
      // 2 completed / (2 completed + 1 failed) = 66.67% -> rounds to 67
      expect(result.current.stats?.successRate).toBe(67)
      // 1 processing + 1 analyzing = 2
      expect(result.current.stats?.processingNow).toBe(2)
    })

    it('should handle empty data gracefully', async () => {
      setupSuccessMocks({
        documents: [],
        templateCount: 0,
        templatesThisMonthCount: 0,
      })

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      })

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false)
        },
        { timeout: 5000 }
      )

      expect(result.current.stats?.totalDocuments).toBe(0)
      expect(result.current.stats?.totalTemplates).toBe(0)
      expect(result.current.stats?.successRate).toBe(0)
      expect(result.current.stats?.processingNow).toBe(0)
    })

    it('should provide refetch functions', async () => {
      setupSuccessMocks({ documents: [], templateCount: 5 })

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      })

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false)
        },
        { timeout: 5000 }
      )

      expect(typeof result.current.refetch).toBe('function')
      expect(typeof result.current.refetchMonthly).toBe('function')
    })
  })

  describe('Success Rate Calculation', () => {
    it('should calculate 100% when all documents completed', async () => {
      const testDocuments = [
        { id: 1, processing_status: 'completed', created_at: new Date().toISOString() },
        { id: 2, processing_status: 'completed', created_at: new Date().toISOString() },
        { id: 3, processing_status: 'completed', created_at: new Date().toISOString() },
      ]

      setupSuccessMocks({ documents: testDocuments, templateCount: 0 })

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      })

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false)
        },
        { timeout: 5000 }
      )

      expect(result.current.stats?.successRate).toBe(100)
    })

    it('should calculate 0% when all documents failed', async () => {
      const testDocuments = [
        { id: 1, processing_status: 'failed', created_at: new Date().toISOString() },
        { id: 2, processing_status: 'failed', created_at: new Date().toISOString() },
      ]

      setupSuccessMocks({ documents: testDocuments, templateCount: 0 })

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      })

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false)
        },
        { timeout: 5000 }
      )

      expect(result.current.stats?.successRate).toBe(0)
    })

    it('should not count processing/uploaded documents in success rate', async () => {
      const testDocuments = [
        { id: 1, processing_status: 'completed', created_at: new Date().toISOString() },
        { id: 2, processing_status: 'processing', created_at: new Date().toISOString() },
        { id: 3, processing_status: 'uploaded', created_at: new Date().toISOString() },
        { id: 4, processing_status: 'analyzing', created_at: new Date().toISOString() },
      ]

      setupSuccessMocks({ documents: testDocuments, templateCount: 0 })

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      })

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false)
        },
        { timeout: 5000 }
      )

      // Only 1 completed, 0 failed -> 100%
      expect(result.current.stats?.successRate).toBe(100)
      // 1 processing + 1 analyzing = 2
      expect(result.current.stats?.processingNow).toBe(2)
    })
  })

  describe('Type exports', () => {
    it('should export DashboardStats type with correct shape', () => {
      const stats: DashboardStats = {
        totalDocuments: 10,
        totalTemplates: 5,
        successRate: 85,
        processingNow: 2,
        documentsThisMonth: 3,
        documentsLastMonth: 4,
        templatesThisMonth: 1,
      }

      expect(stats.totalDocuments).toBe(10)
      expect(stats.totalTemplates).toBe(5)
      expect(stats.successRate).toBe(85)
      expect(stats.processingNow).toBe(2)
      expect(stats.documentsThisMonth).toBe(3)
      expect(stats.documentsLastMonth).toBe(4)
      expect(stats.templatesThisMonth).toBe(1)
    })

    it('should export MonthlyDocumentData type with correct shape', () => {
      const monthlyData: MonthlyDocumentData = {
        month: 'Jan',
        count: 42,
      }

      expect(monthlyData.month).toBe('Jan')
      expect(monthlyData.count).toBe(42)
    })
  })
})
