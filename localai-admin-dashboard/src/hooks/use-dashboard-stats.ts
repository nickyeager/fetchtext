/**
 * Dashboard Statistics Hook
 *
 * Fetches real document and template statistics from Supabase
 * for display on the dashboard. Uses TanStack Query for caching
 * and automatic refetching.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { withAuthentication } from '@/lib/supabase-auth-utils'

export interface DashboardStats {
  totalDocuments: number
  totalTemplates: number
  successRate: number // % of completed vs failed (0-100)
  processingNow: number // documents in processing/analyzing state
  documentsThisMonth: number
  documentsLastMonth: number
  templatesThisMonth: number
}

export interface MonthlyDocumentData {
  month: string // e.g., "Jan", "Feb"
  count: number
}

interface DashboardStatsResult {
  stats: DashboardStats | undefined
  monthlyData: MonthlyDocumentData[]
  isLoading: boolean
  isLoadingMonthly: boolean
  error: Error | null
  errorMonthly: Error | null
  refetch: () => void
  refetchMonthly: () => void
}

// Query key factory for consistent caching
const dashboardQueries = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardQueries.all, 'stats'] as const,
  monthly: () => [...dashboardQueries.all, 'monthly'] as const,
}

// Month name mapping for chart labels
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Get the start of a month for a given date
 */
function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Get the end of a month for a given date
 */
function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Fetch dashboard statistics from Supabase
 */
async function fetchDashboardStats(): Promise<DashboardStats> {
  return withAuthentication(async () => {
    const now = new Date()
    const thisMonthStart = getMonthStart(now)
    const lastMonthStart = getMonthStart(
      new Date(now.getFullYear(), now.getMonth() - 1, 1)
    )
    const lastMonthEnd = getMonthEnd(
      new Date(now.getFullYear(), now.getMonth() - 1, 1)
    )

    // Fetch all documents with processing status
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('id, processing_status, created_at')

    if (documentsError) {
      console.error('[useDashboardStats] Error fetching documents:', documentsError)
      throw new Error(`Failed to fetch documents: ${documentsError.message}`)
    }

    // Fetch template count
    const { count: templateCount, error: templatesError } = await supabase
      .from('smart_templates')
      .select('id', { count: 'exact', head: true })

    if (templatesError) {
      console.error('[useDashboardStats] Error fetching templates:', templatesError)
      throw new Error(`Failed to fetch templates: ${templatesError.message}`)
    }

    // Fetch templates created this month
    const { count: templatesThisMonthCount, error: templatesThisMonthError } =
      await supabase
        .from('smart_templates')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thisMonthStart.toISOString())

    if (templatesThisMonthError) {
      console.error(
        '[useDashboardStats] Error fetching templates this month:',
        templatesThisMonthError
      )
      // Non-critical, continue with 0
    }

    // Calculate statistics from documents
    const totalDocuments = documents?.length || 0
    const totalTemplates = templateCount || 0
    const templatesThisMonth = templatesThisMonthCount || 0

    // Count completed and failed documents
    let completedCount = 0
    let failedCount = 0
    let processingCount = 0
    let documentsThisMonth = 0
    let documentsLastMonth = 0

    documents?.forEach((doc) => {
      const createdAt = new Date(doc.created_at)

      // Count by status
      if (doc.processing_status === 'completed') {
        completedCount++
      } else if (doc.processing_status === 'failed') {
        failedCount++
      } else if (
        doc.processing_status === 'processing' ||
        doc.processing_status === 'analyzing'
      ) {
        processingCount++
      }

      // Count by month
      if (createdAt >= thisMonthStart) {
        documentsThisMonth++
      } else if (createdAt >= lastMonthStart && createdAt <= lastMonthEnd) {
        documentsLastMonth++
      }
    })

    // Calculate success rate (completed / (completed + failed))
    // If no completed or failed documents, return 0
    const totalProcessed = completedCount + failedCount
    const successRate =
      totalProcessed > 0
        ? Math.round((completedCount / totalProcessed) * 100)
        : 0

    console.log('[useDashboardStats] Stats calculated:', {
      totalDocuments,
      totalTemplates,
      successRate,
      processingNow: processingCount,
      documentsThisMonth,
      documentsLastMonth,
      templatesThisMonth,
    })

    return {
      totalDocuments,
      totalTemplates,
      successRate,
      processingNow: processingCount,
      documentsThisMonth,
      documentsLastMonth,
      templatesThisMonth,
    }
  }, 'fetchDashboardStats')
}

/**
 * Fetch monthly document data for the last 12 months
 */
async function fetchMonthlyDocumentData(): Promise<MonthlyDocumentData[]> {
  return withAuthentication(async () => {
    const now = new Date()
    const twelveMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1
    )

    // Fetch documents from the last 12 months
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, created_at')
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      console.error(
        '[useDashboardStats] Error fetching monthly data:',
        error
      )
      throw new Error(`Failed to fetch monthly document data: ${error.message}`)
    }

    // Initialize counts for each of the last 12 months
    const monthlyCounts: Map<string, number> = new Map()

    // Generate keys for the last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      monthlyCounts.set(key, 0)
    }

    // Count documents per month
    documents?.forEach((doc) => {
      const createdAt = new Date(doc.created_at)
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`
      if (monthlyCounts.has(key)) {
        monthlyCounts.set(key, (monthlyCounts.get(key) || 0) + 1)
      }
    })

    // Convert to array with month names
    const monthlyData: MonthlyDocumentData[] = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      monthlyData.push({
        month: MONTH_NAMES[date.getMonth()],
        count: monthlyCounts.get(key) || 0,
      })
    }

    console.log('[useDashboardStats] Monthly data calculated:', monthlyData)

    return monthlyData
  }, 'fetchMonthlyDocumentData')
}

/**
 * Hook for dashboard statistics
 * Uses 1 minute stale time and refetch interval for near real-time updates
 */
export function useDashboardStats(): DashboardStatsResult {
  // Query for main stats with 1 minute cache
  const statsQuery = useQuery({
    queryKey: dashboardQueries.stats(),
    queryFn: fetchDashboardStats,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every 1 minute
    refetchOnWindowFocus: true,
    retry: 2,
  })

  // Query for monthly data with 5 minute cache (less volatile)
  const monthlyQuery = useQuery({
    queryKey: dashboardQueries.monthly(),
    queryFn: fetchMonthlyDocumentData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  })

  return {
    stats: statsQuery.data,
    monthlyData: monthlyQuery.data || [],
    isLoading: statsQuery.isLoading,
    isLoadingMonthly: monthlyQuery.isLoading,
    error: statsQuery.error,
    errorMonthly: monthlyQuery.error,
    refetch: () => statsQuery.refetch(),
    refetchMonthly: () => monthlyQuery.refetch(),
  }
}
