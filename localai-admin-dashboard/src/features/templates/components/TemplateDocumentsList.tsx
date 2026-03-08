import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileText, Upload, Target } from 'lucide-react'
import { format } from 'date-fns'
import { UnifiedDocumentService } from '@/services/unified-document-service'
import { getMatchScoreBadgeVariant } from '@/lib/confidence-utils'
import { formatFileSize, getStatusColor, getStatusLabel } from '@/lib/document-utils'

interface TemplateDocumentsListProps {
  templateId: number
  templateName?: string
}

export function TemplateDocumentsList({
  templateId,
  templateName,
}: TemplateDocumentsListProps) {
  const navigate = useNavigate()

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['templateDocuments', templateId],
    queryFn: () => UnifiedDocumentService.getDocumentsByTemplate(templateId),
  })

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        Loading documents...
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-12'>
        <FileText className='h-10 w-10 text-muted-foreground/50' />
        <p className='text-sm text-muted-foreground'>
          No documents processed with this template yet.
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            navigate({
              to: '/documents/upload',
              search: { templateId: String(templateId), templateName },
            })
          }
        >
          <Upload className='mr-2 h-4 w-4' />
          Upload a Document
        </Button>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          {documents.length} document{documents.length !== 1 ? 's' : ''} processed
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            navigate({
              to: '/documents/upload',
              search: { templateId: String(templateId), templateName },
            })
          }
        >
          <Upload className='mr-2 h-4 w-4' />
          Upload New
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const matchScore = (doc.metadata as any)?.template_decision
                ?.match_score as number | undefined

              return (
                <TableRow
                  key={doc.id}
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() =>
                    navigate({ to: `/documents/${doc.id}` })
                  }
                >
                  <TableCell>
                    <div
                      className='max-w-[240px] truncate font-medium'
                      title={doc.name}
                    >
                      {doc.name || 'Untitled'}
                    </div>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatFileSize(doc.file_size || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant='outline'
                      className={`text-xs ${getStatusColor(
                        doc.status || doc.processing_status || 'pending',
                      )}`}
                    >
                      {getStatusLabel(
                        doc.status || doc.processing_status || 'pending',
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {matchScore != null ? (
                      <div className='flex items-center gap-1'>
                        <Target className='h-3 w-3 text-muted-foreground' />
                        <Badge
                          variant={getMatchScoreBadgeVariant(matchScore)}
                          className='text-[10px]'
                        >
                          {Math.round(matchScore * 100)}%
                        </Badge>
                      </div>
                    ) : (
                      <span className='text-xs text-muted-foreground'>
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {doc.created_at
                      ? format(new Date(doc.created_at), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
