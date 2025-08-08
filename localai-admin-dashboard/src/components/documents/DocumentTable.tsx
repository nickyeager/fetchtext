import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  MoreHorizontal, 
  FileText, 
  Download, 
  RefreshCw, 
  Eye, 
  Trash2, 
  File, 
  FileSpreadsheet, 
  FileCode, 
  Image,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format } from 'date-fns';
import { Document, SortParams } from '@/hooks/use-document-gallery';

interface DocumentTableProps {
  documents: Document[];
  sort: SortParams;
  onView: (id: number) => void;
  onReprocess: (id: number) => void;
  onDelete: (id: number) => void;
  onDownload: (id: number) => void;
  onSortChange: (sort: SortParams) => void;
  isLoading?: boolean;
}

export function DocumentTable({ 
  documents,
  sort,
  onView, 
  onReprocess, 
  onDelete, 
  onDownload,
  onSortChange,
  isLoading = false 
}: DocumentTableProps) {
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
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
      case 'txt':
      case 'md':
        return <FileCode className="w-4 h-4 text-gray-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <Image className="w-4 h-4 text-purple-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
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

  const handleSort = (field: SortParams['field']) => {
    const newDirection = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ field, direction: newDirection });
  };

  const getSortIcon = (field: SortParams['field']) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sort.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const handleAction = (action: () => void, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isLoading) {
      action();
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="h-auto p-0 font-semibold hover:bg-transparent"
                onClick={() => handleSort('filename')}
              >
                Name
                {getSortIcon('filename')}
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="h-auto p-0 font-semibold hover:bg-transparent"
                onClick={() => handleSort('file_size')}
              >
                Size
                {getSortIcon('file_size')}
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="h-auto p-0 font-semibold hover:bg-transparent"
                onClick={() => handleSort('status')}
              >
                Status
                {getSortIcon('status')}
              </Button>
            </TableHead>
            <TableHead>Type</TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="h-auto p-0 font-semibold hover:bg-transparent"
                onClick={() => handleSort('upload_date')}
              >
                Upload Date
                {getSortIcon('upload_date')}
              </Button>
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                No documents found
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => (
              <TableRow 
                key={document.id} 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => !isLoading && onView(document.id)}
              >
                <TableCell>
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-50 rounded border">
                    {document.thumbnail_url ? (
                      <img 
                        src={document.thumbnail_url} 
                        alt={`${document.filename} preview`}
                        className="w-6 h-6 object-cover rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '';
                            const icon = getFileTypeIcon(document.file_type);
                            parent.appendChild(icon.type({
                              ...icon.props,
                              className: 'w-4 h-4 text-gray-500'
                            }));
                          }
                        }}
                      />
                    ) : (
                      getFileTypeIcon(document.file_type || 'unknown')
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900 max-w-xs truncate" title={document.filename || 'Untitled'}>
                    {document.filename || 'Untitled Document'}
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">
                  {formatFileSize(document.file_size || 0)}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getStatusColor(document.status || 'pending')}`}
                  >
                    {getStatusLabel(document.status || 'pending')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {document.document_type && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getDocumentTypeColor(document.document_type)}`}
                    >
                      {document.document_type}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-gray-600">
                  {document.upload_date ? format(new Date(document.upload_date), 'MMM d, yyyy') : 'Unknown'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
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
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}