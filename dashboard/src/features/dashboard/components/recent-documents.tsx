/**
 * Recent Documents Component
 *
 * Displays the 5 most recently uploaded documents with their
 * processing status. Uses TanStack Query for data fetching
 * with automatic 30-second refresh.
 */

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

/**
 * Fetch the 5 most recent documents for the authenticated user
 */
async function fetchRecentDocuments(): Promise<RecentDocument[]> {
  return withAuthentication(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, file_type, processing_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      if (!error.message?.includes('Failed to fetch')) {
        console.error('[RecentDocuments] Error fetching documents:', error)
      }
      throw new Error(`Failed to fetch recent documents: ${error.message}`)
    }

    return data || []
  }, 'fetchRecentDocuments')
}

/**
 * Get appropriate icon based on file MIME type
 */
function getFileIcon(fileType: string) {
  const type = fileType?.toLowerCase() || ''

  if (type.includes('pdf')) {
    return FileText
  }
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type.includes('csv') ||
    type.includes('xlsx') ||
    type.includes('xls')
  ) {
    return FileSpreadsheet
  }
  if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg') || type.includes('gif')) {
    return FileImage
  }
  return File
}

/**
 * Render status badge with appropriate styling
 */
function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant='default' className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'>
          Completed
        </Badge>
      )
    case 'processing':
    case 'analyzing':
      return (
        <Badge variant='default' className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
          Processing
        </Badge>
      )
    case 'failed':
      return <Badge variant='destructive'>Failed</Badge>
    case 'uploaded':
    default:
      return <Badge variant='secondary'>Pending</Badge>
  }
}

/**
 * Loading skeleton for documents list
 */
function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      {[...Array(5)].map((_, i) => (
        <div key={i} className='flex items-center gap-4 animate-pulse'>
          <div className='h-9 w-9 rounded-full bg-muted' />
          <div className='flex-1 space-y-2'>
            <div className='h-4 bg-muted rounded w-3/4' />
            <div className='h-3 bg-muted rounded w-1/2' />
          </div>
          <div className='h-5 w-16 bg-muted rounded' />
        </div>
      ))}
    </div>
  )
}

/**
 * Empty state when no documents exist
 */
function EmptyState() {
  return (
    <div className='text-center py-8 text-muted-foreground'>
      <FileText className='h-12 w-12 mx-auto mb-2 opacity-50' />
      <p>No documents uploaded yet</p>
    </div>
  )
}

/**
 * Recent Documents Component
 *
 * Shows the 5 most recently uploaded documents with:
 * - File type icon
 * - Truncated document name
 * - Relative upload time
 * - Processing status badge
 *
 * Automatically refetches every 30 seconds.
 */
export function RecentDocuments() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['recent-documents'],
    queryFn: fetchRecentDocuments,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  })

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (documents.length === 0) {
    return <EmptyState />
  }

  return (
    <div className='space-y-6'>
      {documents.map((doc) => {
        const Icon = getFileIcon(doc.file_type)
        return (
          <div key={doc.id} className='flex items-center gap-4'>
            <div className='h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0'>
              <Icon className='h-4 w-4' />
            </div>
            <div className='flex flex-1 flex-wrap items-center justify-between gap-2 min-w-0'>
              <div className='space-y-1 min-w-0'>
                <p className='text-sm font-medium leading-none truncate max-w-[200px]' title={doc.name}>
                  {doc.name}
                </p>
                <p className='text-muted-foreground text-xs'>
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
