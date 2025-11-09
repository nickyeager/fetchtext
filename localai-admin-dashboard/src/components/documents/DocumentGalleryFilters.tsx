import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon, 
  SortAsc, 
  SortDesc,
  FileText,
  Clock,
   Zap
} from 'lucide-react';
// Simple debounce implementation
const debounceString = (func: (value: string) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (value: string) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(value), wait);
  };
};
import { format } from 'date-fns';
import type { DocumentFilters, SortParams } from '@/hooks/use-document-gallery';

interface DocumentGalleryFiltersProps {
  filters: DocumentFilters;
  sort: SortParams;
  onFiltersChange: (filters: DocumentFilters) => void;
  onSortChange: (sort: SortParams) => void;
  isLoading?: boolean;
  documentStats?: {
    total: number;
    by_status: Record<string, number>;
    by_file_type: Record<string, number>;
    by_document_type: Record<string, number>;
  };
}

export function DocumentGalleryFilters({ 
  filters,
  sort,
  onFiltersChange, 
  onSortChange,
  isLoading = false,
  documentStats
}: DocumentGalleryFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search to avoid excessive API calls
  const debouncedSearchChange = useMemo(() =>
    debounceString((value: string) => {
      onFiltersChange({ ...filters, search: value || undefined });
    }, 300)
  , [filters, onFiltersChange]);

  useEffect(() => {
    debouncedSearchChange(searchValue);
  }, [searchValue, debouncedSearchChange]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const clearSearch = () => {
    setSearchValue('');
    onFiltersChange({ ...filters, search: undefined });
  };

  const handleMultiSelectFilter = (
    filterKey: keyof DocumentFilters,
    value: string,
    currentValues: string[] = []
  ) => {
    let newValues: string[];
    
    if (currentValues.includes(value)) {
      newValues = currentValues.filter(v => v !== value);
    } else {
      newValues = [...currentValues, value];
    }
    
    onFiltersChange({
      ...filters,
      [filterKey]: newValues.length > 0 ? newValues : undefined
    });
  };

  const handleDateChange = (field: 'date_from' | 'date_to', date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      [field]: date ? date.toISOString().split('T')[0] : undefined
    });
    setShowDatePicker(null);
  };

  const clearAllFilters = () => {
    setSearchValue('');
    onFiltersChange({});
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status?.length) count += filters.status.length;
    if (filters.file_type?.length) count += filters.file_type.length;
    if (filters.document_type?.length) count += filters.document_type.length;
    if (filters.date_from || filters.date_to) count++;
    return count;
  };

  const statusOptions = [
    { 
      value: 'pending', 
      label: 'Pending', 
      color: 'bg-gray-50 text-gray-700 border-gray-200',
      icon: <Clock className="w-3 h-3" />
    },
    { 
      value: 'analyzing', 
      label: 'Processing', 
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
    },
    { 
      value: 'completed', 
      label: 'Completed', 
      color: 'bg-green-50 text-green-700 border-green-200',
      icon: <div className="w-3 h-3 bg-green-500 rounded-full" />
    },
    { 
      value: 'failed', 
      label: 'Failed', 
      color: 'bg-red-50 text-red-700 border-red-200',
      icon: <X className="w-3 h-3" />
    },
  ];

  const fileTypeOptions = [
    { value: 'pdf', label: 'PDF', count: documentStats?.by_file_type?.pdf || 0 },
    { value: 'docx', label: 'Word Document', count: documentStats?.by_file_type?.docx || 0 },
    { value: 'txt', label: 'Text File', count: documentStats?.by_file_type?.txt || 0 },
    { value: 'xlsx', label: 'Excel', count: documentStats?.by_file_type?.xlsx || 0 },
    { value: 'pptx', label: 'PowerPoint', count: documentStats?.by_file_type?.pptx || 0 },
    { value: 'html', label: 'HTML', count: documentStats?.by_file_type?.html || 0 },
    { value: 'md', label: 'Markdown', count: documentStats?.by_file_type?.md || 0 },
  ].filter(option => option.count > 0);

  const documentTypeOptions = Object.entries(documentStats?.by_document_type || {})
    .map(([type, count]) => ({
      value: type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      count
    }))
    .filter(option => option.count > 0);

  const sortOptions = [
    { field: 'upload_date', label: 'Upload Date', icon: <CalendarIcon className="w-4 h-4" /> },
    { field: 'filename', label: 'Name', icon: <FileText className="w-4 h-4" /> },
    { field: 'file_size', label: 'Size', icon: <FileText className="w-4 h-4" /> },
    { field: 'status', label: 'Status', icon: <Clock className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Search and Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Enhanced Search Bar */}
        <div className="relative flex-1">
          <div className="relative flex">
            <div className="relative flex-1">
              {isSemanticSearch ? (
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-500 w-4 h-4" />
              ) : (
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              )}
              <Input
                ref={searchInputRef}
                placeholder={isSemanticSearch 
                  ? "Semantic search: Find documents by meaning and context..." 
                  : "Search documents by filename or content..."
                }
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={`pl-10 pr-10 ${isSemanticSearch ? 'border-purple-200 focus:border-purple-400' : ''}`}
                disabled={isLoading}
              />
              {searchValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            
            {/* Semantic Search Toggle */}
            <Button
              variant={isSemanticSearch ? "default" : "outline"}
              size="sm"
              onClick={() => setIsSemanticSearch(!isSemanticSearch)}
              className="ml-2 px-3"
              title={isSemanticSearch ? "Switch to text search" : "Switch to semantic search"}
            >
              {isSemanticSearch ? (
                <>
                  <FileText className="w-4 h-4 mr-1" />
                  AI
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-1" />
                  AI
                </>
              )}
            </Button>
          </div>
          
          {/* Search Mode Indicator */}
          {searchValue && (
            <div className="absolute -bottom-5 left-0 text-xs text-gray-500">
              {isSemanticSearch ? (
                <span className="text-purple-600">🧠 Semantic search active</span>
              ) : (
                <span>🔍 Text search active</span>
              )}
            </div>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2">
          <Select
            value={sort.field}
            onValueChange={(field) => onSortChange({ 
              ...sort, 
              field: field as SortParams['field'] 
            })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.field} value={option.field}>
                  <div className="flex items-center space-x-2">
                    {option.icon}
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onSortChange({ 
              ...sort, 
              direction: sort.direction === 'asc' ? 'desc' : 'asc' 
            })}
            className="px-3"
          >
            {sort.direction === 'asc' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="w-4 h-4 mr-2" />
              Status
              {filters.status?.length ? (
                <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                  {filters.status.length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Filter by Status</h4>
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={filters.status?.includes(option.value) || false}
                    onCheckedChange={() => handleMultiSelectFilter(
                      'status', 
                      option.value, 
                      filters.status
                    )}
                  />
                  <label 
                    htmlFor={`status-${option.value}`} 
                    className="text-sm cursor-pointer flex-1 flex items-center space-x-2"
                  >
                    {option.icon}
                    <span>{option.label}</span>
                    <span className="text-xs text-gray-500">
                      ({documentStats?.by_status[option.value] || 0})
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* File Type Filter */}
        {fileTypeOptions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                File Type
                {filters.file_type?.length ? (
                  <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                    {filters.file_type.length}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Filter by File Type</h4>
                {fileTypeOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={`type-${option.value}`}
                      checked={filters.file_type?.includes(option.value) || false}
                      onCheckedChange={() => handleMultiSelectFilter(
                        'file_type', 
                        option.value, 
                        filters.file_type
                      )}
                    />
                    <label 
                      htmlFor={`type-${option.value}`} 
                      className="text-sm cursor-pointer flex-1 flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-500">({option.count})</span>
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Document Type Filter */}
        {documentTypeOptions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Document Type
                {filters.document_type?.length ? (
                  <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                    {filters.document_type.length}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Filter by Document Type</h4>
                {documentTypeOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={`doc-type-${option.value}`}
                      checked={filters.document_type?.includes(option.value) || false}
                      onCheckedChange={() => handleMultiSelectFilter(
                        'document_type', 
                        option.value, 
                        filters.document_type
                      )}
                    />
                    <label 
                      htmlFor={`doc-type-${option.value}`} 
                      className="text-sm cursor-pointer flex-1 flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-500">({option.count})</span>
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Processing Insights Filter - temporarily disabled */}

        {/* Date Range Filter */}
        <Popover open={showDatePicker !== null} onOpenChange={(open) => !open && setShowDatePicker(null)}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Date Range
              {(filters.date_from || filters.date_to) ? (
                <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                  1
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Filter by Upload Date</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">From</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left font-normal"
                    onClick={() => setShowDatePicker('from')}
                  >
                    {filters.date_from 
                      ? format(new Date(filters.date_from), 'MMM d, yyyy')
                      : 'Select date'
                    }
                  </Button>
                </div>
                
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">To</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left font-normal"
                    onClick={() => setShowDatePicker('to')}
                  >
                    {filters.date_to 
                      ? format(new Date(filters.date_to), 'MMM d, yyyy')
                      : 'Select date'
                    }
                  </Button>
                </div>
              </div>
              
              {showDatePicker && (
                <Calendar
                  mode="single"
                  selected={showDatePicker === 'from' 
                    ? filters.date_from ? new Date(filters.date_from) : undefined
                    : filters.date_to ? new Date(filters.date_to) : undefined
                  }
                  onSelect={(date) => handleDateChange(
                    showDatePicker === 'from' ? 'date_from' : 'date_to', 
                    date
                  )}
                  className="rounded-md border"
                />
              )}
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange('date_from', undefined)}
                  disabled={!filters.date_from}
                  className="flex-1"
                >
                  Clear From
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange('date_to', undefined)}
                  disabled={!filters.date_to}
                  className="flex-1"
                >
                  Clear To
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear All Filters */}
        {getActiveFilterCount() > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 text-gray-600 hover:text-gray-900"
          >
            <X className="w-4 h-4 mr-1" />
            Clear All ({getActiveFilterCount()})
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="px-2 py-1 flex items-center space-x-1">
              <span>Search: "{filters.search}"</span>
              <X 
                className="w-3 h-3 cursor-pointer hover:text-red-600" 
                onClick={clearSearch}
              />
            </Badge>
          )}
          
          {filters.status?.map((status) => (
            <Badge key={status} variant="secondary" className="px-2 py-1 flex items-center space-x-1">
              <span>Status: {status}</span>
              <X 
                className="w-3 h-3 cursor-pointer hover:text-red-600" 
                onClick={() => handleMultiSelectFilter('status', status, filters.status)}
              />
            </Badge>
          ))}
          
          {filters.file_type?.map((type) => (
            <Badge key={type} variant="secondary" className="px-2 py-1 flex items-center space-x-1">
              <span>Type: {type}</span>
              <X 
                className="w-3 h-3 cursor-pointer hover:text-red-600" 
                onClick={() => handleMultiSelectFilter('file_type', type, filters.file_type)}
              />
            </Badge>
          ))}
          
          {filters.document_type?.map((type) => (
            <Badge key={type} variant="secondary" className="px-2 py-1 flex items-center space-x-1">
              <span>Doc: {type}</span>
              <X 
                className="w-3 h-3 cursor-pointer hover:text-red-600" 
                onClick={() => handleMultiSelectFilter('document_type', type, filters.document_type)}
              />
            </Badge>
          ))}
          
          {(filters.date_from || filters.date_to) && (
            <Badge variant="secondary" className="px-2 py-1 flex items-center space-x-1">
              <span>
                Date: {filters.date_from ? format(new Date(filters.date_from), 'MMM d') : '...'} 
                {' to '}
                {filters.date_to ? format(new Date(filters.date_to), 'MMM d') : '...'}
              </span>
              <X 
                className="w-3 h-3 cursor-pointer hover:text-red-600" 
                onClick={() => onFiltersChange({
                  ...filters,
                  date_from: undefined,
                  date_to: undefined
                })}
              />
            </Badge>
          )}

          {null}
        </div>
      )}
    </div>
  );
}