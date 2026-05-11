/**
 * StageFileBrowser Component
 *
 * File browser within a Snowflake stage.
 * Shows a table of files with multi-select and batch processing.
 */

import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  FileText,
  FileSpreadsheet,
  Image,
  File,
  Loader2,
  Download,
  CheckSquare,
  Square,
  Filter,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  snowflakeService,
  snowflakeKeys,
  type SnowflakeStageFile,
} from '@/lib/services/snowflake-service'

interface StageFileBrowserProps {
  organizationId: string
  stageName: string
  onProcess?: (files: SnowflakeStageFile[]) => void
}

function getFileIcon(file: SnowflakeStageFile) {
  if (file.file_category === 'data') {
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />
  }
  const ext = file.extension.toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif'].includes(ext)) {
    return <Image className="h-4 w-4 text-purple-600" />
  }
  if (['.pdf', '.docx', '.doc', '.txt', '.md'].includes(ext)) {
    return <FileText className="h-4 w-4 text-blue-600" />
  }
  return <File className="h-4 w-4 text-gray-500" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function StageFileBrowser({
  organizationId,
  stageName,
  onProcess,
}: StageFileBrowserProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [processingFile, setProcessingFile] = useState<string | null>(null)
  const [processingBatch, setProcessingBatch] = useState(false)

  const mountedRef = useRef(true)
  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const filterParam =
    typeFilter === 'all' ? undefined : typeFilter === 'documents' ? 'documents' : 'data'

  const { data: files, isLoading } = useQuery({
    queryKey: snowflakeKeys.files(organizationId, stageName, typeFilter),
    queryFn: () =>
      snowflakeService.listFiles(organizationId, stageName, {
        fileTypeFilter: filterParam,
      }),
  })

  const toggleFile = useCallback((filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (!files) return
    const processableFiles = files.filter((f) => f.is_processable)
    if (selectedFiles.size === processableFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(processableFiles.map((f) => f.full_path)))
    }
  }, [files, selectedFiles.size])

  const handleProcessSingle = async (file: SnowflakeStageFile) => {
    setProcessingFile(file.full_path)
    try {
      const result = await snowflakeService.downloadAndProcess(
        organizationId,
        stageName,
        file.full_path
      )
      if (result.success) {
        toast.success(`Processed ${file.name}`, {
          description: `Status: ${result.processing_status}`,
        })
        onProcess?.([file])
      }
    } catch (error) {
      toast.error(`Failed to process ${file.name}`, {
        description:
          error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      if (mountedRef.current) setProcessingFile(null)
    }
  }

  const handleProcessBatch = async () => {
    if (selectedFiles.size === 0) return
    setProcessingBatch(true)
    try {
      const filePaths = Array.from(selectedFiles)
      const result = await snowflakeService.batchDownload(
        organizationId,
        stageName,
        filePaths
      )
      if (result.success) {
        toast.success(`Processing ${result.total_files} files`, {
          description: `Batch ID: ${result.batch_id}`,
        })
        setSelectedFiles(new Set())
        const selected = files?.filter((f) => filePaths.includes(f.full_path))
        if (selected) onProcess?.(selected)
      }
    } catch (error) {
      toast.error('Batch processing failed', {
        description:
          error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      if (mountedRef.current) setProcessingBatch(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading files from {stageName}...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              <SelectItem value="documents">Documents</SelectItem>
              <SelectItem value="data">Data Files</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {files?.length ?? 0} files
          </span>
        </div>
        {selectedFiles.size > 0 && (
          <Button
            size="sm"
            onClick={handleProcessBatch}
            disabled={processingBatch}
          >
            {processingBatch ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Process Selected ({selectedFiles.size})
          </Button>
        )}
      </div>

      {/* File table */}
      {files && files.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      files.filter((f) => f.is_processable).length > 0 &&
                      selectedFiles.size ===
                        files.filter((f) => f.is_processable).length
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-32">Modified</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.full_path}>
                  <TableCell>
                    {file.is_processable && (
                      <Checkbox
                        checked={selectedFiles.has(file.full_path)}
                        onCheckedChange={() => toggleFile(file.full_path)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getFileIcon(file)}
                      <span className="text-sm">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {file.extension || 'unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {file.last_modified
                      ? new Date(file.last_modified).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {file.is_processable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProcessSingle(file)}
                        disabled={processingFile === file.full_path}
                      >
                        {processingFile === file.full_path ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No files found in this stage
        </p>
      )}
    </div>
  )
}
