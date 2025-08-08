import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, Download, RefreshCw, Eye, Trash2, File, FileSpreadsheet, FileCode, Image } from 'lucide-react';
import { format } from 'date-fns';

interface DocumentCardProps {
  document: {
    id: number;
    filename: string;
    file_size: number;
    upload_date: string;
    status: 'pending' | 'analyzing' | 'completed' | 'failed';
    document_type?: string;
    file_type: string;
    thumbnail_url?: string;
    metadata?: Record<string, any>;
  };
  onView: (id: number) => void;
  onReprocess: (id: number) => void;
  onDelete: (id: number) => void;
  onDownload: (id: number) => void;
  isLoading?: boolean;
}

export function DocumentCard({ 
  document, 
  onView, 
  onReprocess, 
  onDelete, 
  onDownload,
  isLoading = false 
}: DocumentCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': 
        return 'bg-green-50 text-green-700 border-green-200';
      case 'analyzing': 
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed': 
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
      default: 
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'analyzing': return 'Processing';
      case 'failed': return 'Failed';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case 'txt':
      case 'md':
        return <FileCode className="w-5 h-5 text-gray-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <Image className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const getDocumentTypeColor = (docType?: string) => {
    if (!docType) return 'bg-gray-100 text-gray-600';
    
    switch (docType.toLowerCase()) {
      case 'invoice':
        return 'bg-yellow-100 text-yellow-800';
      case 'contract':
        return 'bg-purple-100 text-purple-800';
      case 'report':
        return 'bg-blue-100 text-blue-800';
      case 'form':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const handleAction = (action: () => void, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isLoading) {
      console.log('DocumentCard action triggered for document:', document.id, document.filename || document.name);
      action();
    } else {
      console.log('Action blocked - component is loading');
    }
  };

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-0 shadow-sm hover:scale-[1.02]"
      onClick={() => !isLoading && onView(document.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {/* Document thumbnail or file type icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border">
              {document.thumbnail_url ? (
                <img 
                  src={document.thumbnail_url} 
                  alt={`${document.filename} preview`}
                  className="w-10 h-10 object-cover rounded-md"
                  onError={(e) => {
                    // Fallback to icon if thumbnail fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = '';
                      parent.appendChild(getFileTypeIcon(document.file_type).type({
                        ...getFileTypeIcon(document.file_type).props,
                        className: 'w-6 h-6 text-gray-500'
                      }));
                    }
                  }}
                />
              ) : (
                getFileTypeIcon(document.file_type)
              )}
            </div>
            
            {/* Document info */}
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3 
                className="font-medium text-sm truncate text-gray-900 group-hover:text-blue-600 transition-colors block" 
                title={document.filename}
              >
                {document.filename}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-xs text-gray-500">
                  {formatFileSize(document.file_size)}
                </p>
                <span className="text-xs text-gray-300">•</span>
                <p className="text-xs text-gray-500">
                  {format(new Date(document.upload_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                disabled={isLoading}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                onClick={(e) => handleAction(() => onView(document.id), e)}
                className="cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => handleAction(() => onReprocess(document.id), e)}
                className="cursor-pointer"
                disabled={document.status === 'analyzing'}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reprocess
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => handleAction(() => onDownload(document.id), e)}
                className="cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => handleAction(() => onDelete(document.id), e)}
                className="text-red-600 focus:text-red-600 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-wrap gap-1">
            {/* Status badge */}
            <Badge 
              variant="outline" 
              className={`text-xs font-medium ${getStatusColor(document.status)}`}
            >
              {getStatusLabel(document.status)}
            </Badge>
            
            {/* Document type badge */}
            {document.document_type && (
              <Badge 
                variant="outline" 
                className={`text-xs ${getDocumentTypeColor(document.document_type)}`}
              >
                {document.document_type}
              </Badge>
            )}

            {/* Processing/Action indicators */}
            {document.status === 'analyzing' && !isLoading && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs text-blue-600">Processing...</span>
              </div>
            )}
            {isLoading && (
              <div className="flex items-center space-x-1">
                <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />
                <span className="text-xs text-gray-600">Working...</span>
              </div>
            )}
          </div>
          
          {/* Quick action buttons */}
          <div className="flex items-center space-x-1">
            {/* Quick delete button - visible on hover with enhanced styling */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => handleAction(() => onDelete(document.id), e)}
              className="opacity-0 group-hover:opacity-100 transition-all duration-200 h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 hover:scale-110 border border-transparent hover:border-red-200"
              disabled={isLoading}
              title="Delete document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            
            {/* Quick view button */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => handleAction(() => onView(document.id), e)}
              className="opacity-0 group-hover:opacity-100 transition-all duration-200 h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50 hover:scale-110 border border-transparent hover:border-blue-200"
              disabled={isLoading}
              title="View document details"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Additional metadata if available */}
        {document.metadata && Object.keys(document.metadata).length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              {document.metadata.pages && (
                <span>{document.metadata.pages} pages</span>
              )}
              {document.metadata.language && (
                <>
                  <span>•</span>
                  <span>{document.metadata.language}</span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}