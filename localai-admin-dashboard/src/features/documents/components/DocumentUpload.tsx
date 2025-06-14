import React, { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type Document } from '../data/schema'
import { Upload, FileText, Trash2, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// import { useToast } from '@/hooks/use-toast'

interface DocumentUploadProps {
  documents: Document[]
  onDocumentSelect: (document: Document) => void
  onRefresh: () => void
}

export default function DocumentUpload({ documents, onDocumentSelect, onRefresh }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // const { toast } = useToast()

  const uploadDocument = async (file: File) => {
    try {
      setUploading(true)
      
      const user = await supabase.auth.getUser()
      if (!user.data.user) throw new Error('No user found')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.data.user.id}/${Date.now()}.${fileExt}`
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Extract text content (simplified - in production, use proper text extraction)
      let contentText = ''
      if (file.type.startsWith('text/')) {
        contentText = await file.text()
      }

      // Insert document record
      const { error } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          file_path: uploadData.path,
          file_type: file.type,
          file_size: file.size,
          content_text: contentText,
          uploaded_by: user.data.user.id
        })
        .select()

      if (error) throw error

      onRefresh()
      // TODO: Add toast notification when useToast hook is available
      alert('Document uploaded successfully!')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error uploading document:', error)
      // TODO: Add toast notification when useToast hook is available
      alert('Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      uploadDocument(files[0])
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const deleteDocument = async (document: Document) => {
    try {
      // Delete from storage
      await supabase.storage
        .from('documents')
        .remove([document.file_path])

      // Delete from database
      await supabase
        .from('documents')
        .delete()
        .eq('id', document.id)

      onRefresh()
      // TODO: Add toast notification when useToast hook is available
      alert('Document deleted successfully')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error deleting document:', error)
      // TODO: Add toast notification when useToast hook is available
      alert('Failed to delete document')
    }
  }

  const downloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error downloading document:', error)
      // TODO: Add toast notification when useToast hook is available
      alert('Failed to download document')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium">
                  {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  accept=".txt,.pdf,.doc,.docx,.md"
                />
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                Supports: TXT, PDF, DOC, DOCX, MD files
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Documents</CardTitle>
          <CardDescription>
            {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No documents uploaded yet. Upload your first document above.
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{document.name}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">{document.file_type}</Badge>
                        <span>•</span>
                        <span>{formatFileSize(document.file_size)}</span>
                        <span>•</span>
                        <span>
                          {new Date(document.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDocumentSelect(document)}
                      title="View Document"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadDocument(document)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDocument(document)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 