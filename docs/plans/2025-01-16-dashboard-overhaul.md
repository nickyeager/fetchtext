# Dashboard Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace fake SaaS metrics with real FetchText document processing data

**Architecture:** The dashboard will use existing `useDocumentStats()` hook for document metrics and `templateService.getTemplateStats()` for template data. New components will query Supabase directly via React Query.

**Tech Stack:** React, TanStack Query, Supabase, recharts, shadcn/ui, Lucide icons

---

## Current State (What Exists)

The dashboard at `src/features/dashboard/index.tsx` shows fake metrics:
- "Total Revenue: $45,231.89" - FAKE
- "Subscriptions: +2350" - FAKE
- "Sales: +12,234" - FAKE
- "Active Now: +573" - FAKE
- Bar chart with random revenue data - FAKE
- "Recent Sales" with fake user names - FAKE
- ProcessingMonitorWidget - REAL (keep this)

## Target State (What We're Building)

Real FetchText metrics:
- **Documents Processed** - Total documents in system
- **Templates Created** - Total smart templates
- **Success Rate** - % of documents completed vs failed
- **Processing Now** - Documents currently in processing state
- **Documents Per Month** - Real bar chart of documents by month
- **Recent Documents** - Last 5 uploaded documents with status

---

## Task 1: Create Dashboard Stats Hook

**Files:**
- Create: `src/hooks/use-dashboard-stats.ts`
- Test: `src/__tests__/hooks/use-dashboard-stats.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/hooks/use-dashboard-stats.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDashboardStats } from '@/hooks/use-dashboard-stats'

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useDashboardStats', () => {
  it('should return dashboard statistics', async () => {
    const { result } = renderHook(() => useDashboardStats(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.stats).toBeDefined()
    expect(typeof result.current.stats?.totalDocuments).toBe('number')
    expect(typeof result.current.stats?.totalTemplates).toBe('number')
    expect(typeof result.current.stats?.successRate).toBe('number')
    expect(typeof result.current.stats?.processingNow).toBe('number')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd localai-admin-dashboard && npx vitest run src/__tests__/hooks/use-dashboard-stats.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-dashboard-stats.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { withAuthentication } from '@/lib/supabase-auth-utils'

export interface DashboardStats {
  totalDocuments: number
  totalTemplates: number
  successRate: number
  processingNow: number
  documentsThisMonth: number
  documentsLastMonth: number
  templatesThisMonth: number
}

export interface MonthlyDocumentData {
  month: string
  count: number
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  return withAuthentication(async (user) => {
    // Fetch document counts
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('processing_status, created_at')

    if (docError) throw docError

    // Fetch template count
    const { count: templateCount, error: templateError } = await supabase
      .from('smart_templates')
      .select('*', { count: 'exact', head: true })

    if (templateError) throw templateError

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const docs = documents || []
    const total = docs.length
    const completed = docs.filter(d => d.processing_status === 'completed').length
    const failed = docs.filter(d => d.processing_status === 'failed').length
    const processing = docs.filter(d =>
      d.processing_status === 'processing' || d.processing_status === 'analyzing'
    ).length

    const thisMonth = docs.filter(d => new Date(d.created_at) >= startOfMonth).length
    const lastMonth = docs.filter(d => {
      const date = new Date(d.created_at)
      return date >= startOfLastMonth && date < startOfMonth
    }).length

    const successRate = total > 0 ? Math.round((completed / (completed + failed || 1)) * 100) : 0

    return {
      totalDocuments: total,
      totalTemplates: templateCount || 0,
      successRate,
      processingNow: processing,
      documentsThisMonth: thisMonth,
      documentsLastMonth: lastMonth,
      templatesThisMonth: 0 // TODO: implement if needed
    }
  }, 'fetchDashboardStats')
}

async function fetchMonthlyDocuments(): Promise<MonthlyDocumentData[]> {
  return withAuthentication(async (user) => {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('created_at')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Group by month
    const monthCounts: Record<string, number> = {}
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Initialize last 12 months with 0
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
      monthCounts[key] = 0
    }

    // Count documents per month
    documents?.forEach(doc => {
      const date = new Date(doc.created_at)
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
      if (key in monthCounts) {
        monthCounts[key]++
      }
    })

    return Object.entries(monthCounts).map(([month, count]) => ({
      month: month.split(' ')[0], // Just the month name for chart
      count
    }))
  }, 'fetchMonthlyDocuments')
}

export function useDashboardStats() {
  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000 // Refresh every minute
  })

  const monthlyQuery = useQuery({
    queryKey: ['dashboard-monthly-documents'],
    queryFn: fetchMonthlyDocuments,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  return {
    stats: statsQuery.data,
    monthlyData: monthlyQuery.data || [],
    isLoading: statsQuery.isLoading || monthlyQuery.isLoading,
    error: statsQuery.error || monthlyQuery.error,
    refetch: () => {
      statsQuery.refetch()
      monthlyQuery.refetch()
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd localai-admin-dashboard && npx vitest run src/__tests__/hooks/use-dashboard-stats.test.ts`
Expected: PASS

---

## Task 2: Create Stat Card Component

**Files:**
- Create: `src/features/dashboard/components/stat-card.tsx`

**Step 1: Create the component**

```typescript
// src/features/dashboard/components/stat-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue
}: StatCardProps) {
  const trendColor = trend === 'up'
    ? 'text-green-600'
    : trend === 'down'
      ? 'text-red-600'
      : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-xs ${trendColor}`}>
          {trendValue && <span>{trendValue} </span>}
          {subtitle}
        </p>
      </CardContent>
    </Card>
  )
}
```

---

## Task 3: Create Documents Overview Chart

**Files:**
- Modify: `src/features/dashboard/components/overview.tsx`

**Step 1: Update the Overview component**

```typescript
// src/features/dashboard/components/overview.tsx
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { MonthlyDocumentData } from '@/hooks/use-dashboard-stats'

interface OverviewProps {
  data: MonthlyDocumentData[]
}

export function Overview({ data }: OverviewProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="month"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          formatter={(value: number) => [`${value} documents`, 'Processed']}
          labelFormatter={(label) => `Month: ${label}`}
        />
        <Bar
          dataKey="count"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

---

## Task 4: Create Recent Documents Component

**Files:**
- Create: `src/features/dashboard/components/recent-documents.tsx`
- Delete: `src/features/dashboard/components/recent-sales.tsx`

**Step 1: Create the component**

```typescript
// src/features/dashboard/components/recent-documents.tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { withAuthentication } from '@/lib/supabase-auth-utils'
import { Badge } from '@/components/ui/badge'
import { FileText, FileSpreadsheet, FileImage, File } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface RecentDocument {
  id: number
  name: string
  file_type: string
  processing_status: string
  created_at: string
}

async function fetchRecentDocuments(): Promise<RecentDocument[]> {
  return withAuthentication(async (user) => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, file_type, processing_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error
    return data || []
  }, 'fetchRecentDocuments')
}

function getFileIcon(fileType: string) {
  switch (fileType?.toLowerCase()) {
    case 'pdf':
      return FileText
    case 'csv':
    case 'xlsx':
    case 'xls':
      return FileSpreadsheet
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return FileImage
    default:
      return File
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
    case 'processing':
    case 'analyzing':
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Processing</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">Pending</Badge>
  }
}

export function RecentDocuments() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['recent-documents'],
    queryFn: fetchRecentDocuments,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-9 w-9 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No documents uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {documents.map((doc) => {
        const Icon = getFileIcon(doc.file_type)
        return (
          <div key={doc.id} className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none truncate max-w-[200px]">
                  {doc.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </p>
              </div>
              {getStatusBadge(doc.processing_status)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Task 5: Update Dashboard Index

**Files:**
- Modify: `src/features/dashboard/index.tsx`

**Step 1: Replace fake metrics with real data**

```typescript
// src/features/dashboard/index.tsx
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Overview } from './components/overview'
import { RecentDocuments } from './components/recent-documents'
import { ProcessingMonitorWidget } from '@/components/documents/ProcessingMonitorWidget'
import { StatCard } from './components/stat-card'
import { useDashboardStats } from '@/hooks/use-dashboard-stats'
import {
  FileText,
  LayoutTemplate,
  CheckCircle,
  Loader2,
  Upload,
  Plus,
  RefreshCw
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

export default function Dashboard() {
  const { stats, monthlyData, isLoading, refetch } = useDashboardStats()

  // Calculate trend for documents
  const docTrend = stats ? (
    stats.documentsThisMonth > stats.documentsLastMonth ? 'up' :
    stats.documentsThisMonth < stats.documentsLastMonth ? 'down' : 'neutral'
  ) : 'neutral'

  const docTrendValue = stats && stats.documentsLastMonth > 0
    ? `${Math.round(((stats.documentsThisMonth - stats.documentsLastMonth) / stats.documentsLastMonth) * 100)}%`
    : undefined

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} />
        <div className="ml-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button asChild>
              <Link to="/documents">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Link>
            </Button>
          </div>
        </div>

        <Tabs
          orientation="vertical"
          defaultValue="overview"
          className="space-y-4"
        >


          <TabsContent value="overview" className="space-y-4">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Documents Processed"
                value={isLoading ? '...' : stats?.totalDocuments || 0}
                subtitle="from last month"
                icon={FileText}
                trend={docTrend}
                trendValue={docTrendValue}
              />
              <StatCard
                title="Templates"
                value={isLoading ? '...' : stats?.totalTemplates || 0}
                subtitle="smart templates"
                icon={LayoutTemplate}
              />
              <StatCard
                title="Success Rate"
                value={isLoading ? '...' : `${stats?.successRate || 0}%`}
                subtitle="extraction accuracy"
                icon={CheckCircle}
                trend={stats && stats.successRate >= 90 ? 'up' : stats && stats.successRate < 70 ? 'down' : 'neutral'}
              />
              <StatCard
                title="Processing Now"
                value={isLoading ? '...' : stats?.processingNow || 0}
                subtitle="documents in queue"
                icon={Loader2}
              />
            </div>

            {/* Charts and Recent Activity */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
              <Card className="col-span-1 lg:col-span-4">
                <CardHeader>
                  <CardTitle>Documents Overview</CardTitle>
                  <CardDescription>
                    Documents processed per month
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <Overview data={monthlyData} />
                </CardContent>
              </Card>

              <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Recent Documents</CardTitle>
                  <CardDescription>
                    Latest uploaded documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentDocuments />
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions and Processing Monitor */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {/* Quick Actions */}
              <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <Link to="/documents">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/templates">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/documents">
                      <FileText className="h-4 w-4 mr-2" />
                      View All Documents
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Processing Monitor */}
              <div className="col-span-1 lg:col-span-1">
                <ProcessingMonitorWidget />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Documents',
    href: '/documents',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Templates',
    href: '/templates',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Settings',
    href: '/settings',
    isActive: false,
    disabled: false,
  },
]
```

---

## Task 6: Clean Up Old Files

**Files:**
- Delete: `src/features/dashboard/components/recent-sales.tsx`

**Step 1: Remove the old component**

Run: `rm localai-admin-dashboard/src/features/dashboard/components/recent-sales.tsx`

---

## Task 7: Build and Test

**Step 1: Build the frontend**

Run: `cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm build`
Expected: Build succeeds with no errors

**Step 2: Test the dashboard manually**

1. Navigate to http://localhost:5173/dashboard
2. Verify stats cards show real data (may be 0 if no documents)
3. Verify chart renders (may be empty if no documents)
4. Verify Recent Documents shows actual documents
5. Verify Quick Actions links work
6. Verify ProcessingMonitorWidget still functions

---

## Success Criteria

After implementation:
- [ ] All stat cards show real database values
- [ ] Bar chart shows documents per month from database
- [ ] Recent Documents shows latest 5 uploads with status badges
- [ ] Quick Actions provide navigation to Documents and Templates
- [ ] Processing Monitor Widget still works
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Dashboard loads without console errors

---

## Files Summary

**Create:**
- `src/hooks/use-dashboard-stats.ts`
- `src/features/dashboard/components/stat-card.tsx`
- `src/features/dashboard/components/recent-documents.tsx`

**Modify:**
- `src/features/dashboard/index.tsx` (major rewrite)
- `src/features/dashboard/components/overview.tsx` (accept props)

**Delete:**
- `src/features/dashboard/components/recent-sales.tsx`
