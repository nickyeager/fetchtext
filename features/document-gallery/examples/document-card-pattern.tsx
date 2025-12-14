// Document Card Component Pattern
// This shows the recommended structure for individual document cards in the gallery

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, Download, RefreshCw, Eye } from 'lucide-react';
import { formatDate } from 'date-fns';

interface DocumentCardProps {
  document: {
    id: string;
    filename: string;
    file_size: number;
    upload_date: string;
    status: 'pending' | 'analyzing' | 'completed' | 'failed';
    document_type?: string;
    file_type: string;
    thumbnail_url?: string;
  };
  onView: (id: string) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
}

export function DocumentCard({ document, onView, onReprocess, onDelete, onDownload }: DocumentCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'analyzing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {/* Document thumbnail or file type icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
              {document.thumbnail_url ? (
                <img 
                  src={document.thumbnail_url} 
                  alt={`${document.filename} preview`}
                  className="w-8 h-8 object-cover rounded"
                />
              ) : (
                <FileText className="w-5 h-5 text-gray-500" />
              )}
            </div>
            
            {/* Document info */}
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate" title={document.filename}>
                {document.filename}
              </h3>
              <p className="text-xs text-gray-500">
                {formatFileSize(document.file_size)} • {formatDate(new Date(document.upload_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(document.id)}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReprocess(document.id)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reprocess
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload(document.id)}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(document.id)}
                className="text-red-600 focus:text-red-600"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(document.status)}>
              {document.status}
            </Badge>
            {document.document_type && (
              <Badge variant="outline" className="text-xs">
                {document.document_type}
              </Badge>
            )}
          </div>
          
          {/* Quick view button */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onView(document.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}