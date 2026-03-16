import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
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

  const docTrend = stats ? (
    stats.documentsThisMonth > stats.documentsLastMonth ? 'up' :
    stats.documentsThisMonth < stats.documentsLastMonth ? 'down' : 'neutral'
  ) : 'neutral'

  const docTrendValue = stats && stats.documentsLastMonth > 0
    ? `${Math.round(((stats.documentsThisMonth - stats.documentsLastMonth) / stats.documentsLastMonth) * 100)}%`
    : undefined

  return (
    <>
      <Header />

      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <div className='flex items-center gap-2 mt-1'>
              {isLoading ? (
                <Badge variant='outline' className='text-xs font-normal text-muted-foreground'>
                  <Loader2 className='h-3 w-3 mr-1 animate-spin' />
                  Loading...
                </Badge>
              ) : (
                <>
                  <Badge variant='outline' className='text-xs font-normal'>
                    <FileText className='h-3 w-3 mr-1' />
                    {stats?.totalDocuments || 0} docs
                  </Badge>
                  <Badge variant='outline' className='text-xs font-normal'>
                    <LayoutTemplate className='h-3 w-3 mr-1' />
                    {stats?.totalTemplates || 0} templates
                  </Badge>
                  <Badge variant={
                    stats && stats.successRate >= 90 ? 'default' :
                    stats && stats.successRate >= 70 ? 'secondary' : 'destructive'
                  } className='text-xs font-normal'>
                    <CheckCircle className='h-3 w-3 mr-1' />
                    {stats?.successRate || 0}% success
                  </Badge>
                  {(stats?.processingNow || 0) > 0 && (
                    <Badge variant='secondary' className='text-xs font-normal'>
                      <Loader2 className='h-3 w-3 mr-1 animate-spin' />
                      {stats?.processingNow} processing
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
          <div className='flex items-center space-x-2'>
            <Button variant='outline' size='sm' onClick={() => refetch()}>
              <RefreshCw className='h-4 w-4 mr-2' />
              Refresh
            </Button>
            <Button asChild>
              <Link to='/documents'>
                <Upload className='h-4 w-4 mr-2' />
                Upload Document
              </Link>
            </Button>
          </div>
        </div>

        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <TabsContent value='overview' className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <StatCard
                title='Documents Processed'
                value={isLoading ? '...' : stats?.totalDocuments || 0}
                subtitle='from last month'
                icon={FileText}
                trend={docTrend}
                trendValue={docTrendValue}
              />
              <StatCard
                title='Templates'
                value={isLoading ? '...' : stats?.totalTemplates || 0}
                subtitle='smart templates'
                icon={LayoutTemplate}
              />
              <StatCard
                title='Success Rate'
                value={isLoading ? '...' : `${stats?.successRate || 0}%`}
                subtitle='extraction accuracy'
                icon={CheckCircle}
                trend={stats && stats.successRate >= 90 ? 'up' : stats && stats.successRate < 70 ? 'down' : 'neutral'}
              />
              <StatCard
                title='Processing Now'
                value={isLoading ? '...' : stats?.processingNow || 0}
                subtitle='documents in queue'
                icon={Loader2}
              />
            </div>

            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-4'>
                <CardHeader>
                  <CardTitle>Documents Overview</CardTitle>
                  <CardDescription>Documents processed per month</CardDescription>
                </CardHeader>
                <CardContent className='pl-2'>
                  <Overview data={monthlyData} />
                </CardContent>
              </Card>

              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Recent Documents</CardTitle>
                  <CardDescription>Latest uploaded documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentDocuments />
                </CardContent>
              </Card>
            </div>

            <div className='grid grid-cols-1 gap-4 lg:grid-cols-4'>
              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className='flex flex-wrap gap-3'>
                  <Button asChild variant='outline'>
                    <Link to='/documents'>
                      <Upload className='h-4 w-4 mr-2' />
                      Upload Document
                    </Link>
                  </Button>
                  <Button asChild variant='outline'>
                    <Link to='/templates'>
                      <Plus className='h-4 w-4 mr-2' />
                      Create Template
                    </Link>
                  </Button>
                  <Button asChild variant='outline'>
                    <Link to='/documents'>
                      <FileText className='h-4 w-4 mr-2' />
                      View All Documents
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <div className='col-span-1 lg:col-span-1'>
                <ProcessingMonitorWidget />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

