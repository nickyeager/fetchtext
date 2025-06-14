import React, { useState, useCallback } from 'react'
import { supabase, type Document } from '../lib/supabase'
import { Upload, FileText, Trash2, Download, Eye } from 'lucide-react'

interface DocumentUploadProps {
  documents: Document[]
  onDocumentSelect: (document: Document) => void
  onRefresh: () => void
}

export default function DocumentUpload({ documents, onDocumentSelect, onRefresh }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

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
      const { data, error } = await supabase
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
      alert('Document uploaded successfully!')
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Error uploading document')
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
    if (!confirm(`Are you sure you want to delete "${document.name}"?`)) return

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
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Error deleting document')
    }
  }

  const downloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = document.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading document:', error)
      alert('Error downloading document')
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900">
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
          <p className="text-xs text-gray-500">
            Supports: TXT, PDF, DOC, DOCX, MD files
          </p>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Your Documents
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
          </p>
        </div>
        <ul className="divide-y divide-gray-200">
          {documents.map((document) => (
            <li key={document.id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {document.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {document.file_type} • {(document.file_size / 1024).toFixed(1)} KB
                    </p>
                    <p className="text-xs text-gray-400">
                      Uploaded {new Date(document.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onDocumentSelect(document)}
                    className="p-2 text-gray-400 hover:text-blue-600"
                    title="View Document"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => downloadDocument(document)}
                    className="p-2 text-gray-400 hover:text-green-600"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteDocument(document)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {documents.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500">
            No documents uploaded yet. Upload your first document above.
          </div>
        )}
      </div>
    </div>
  )
}
