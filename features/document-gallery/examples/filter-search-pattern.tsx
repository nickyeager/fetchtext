// Filter and Search Pattern for Document Gallery
// Shows the recommended approach for implementing search and filtering UI

import { useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, Filter, X, Calendar as CalendarIcon } from 'lucide-react';
import { debounce } from 'lodash';
import { format } from 'date-fns';

interface FilterSearchProps {
  onFiltersChange: (filters: DocumentFilters) => void;
  onSearchChange: (search: string) => void;
  currentFilters: DocumentFilters;
  isLoading?: boolean;
}

export function FilterSearch({ 
  onFiltersChange, 
  onSearchChange, 
  currentFilters, 
  isLoading = false 
}: FilterSearchProps) {
  const [searchValue, setSearchValue] = useState(currentFilters.search || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search to avoid excessive API calls
  const debouncedSearchChange = useCallback(
    debounce((value: string) => {
      onSearchChange(value);
    }, 300),
    [onSearchChange]
  );

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    debouncedSearchChange(value);
  };

  const handleStatusFilter = (status: string) => {
    const currentStatuses = currentFilters.status || [];
    let newStatuses;
    
    if (currentStatuses.includes(status)) {
      newStatuses = currentStatuses.filter(s => s !== status);
    } else {
      newStatuses = [...currentStatuses, status];
    }
    
    onFiltersChange({
      ...currentFilters,
      status: newStatuses.length > 0 ? newStatuses : undefined
    });
  };

  const handleFileTypeFilter = (fileType: string) => {
    const currentTypes = currentFilters.file_type || [];
    let newTypes;
    
    if (currentTypes.includes(fileType)) {
      newTypes = currentTypes.filter(t => t !== fileType);
    } else {
      newTypes = [...currentTypes, fileType];
    }
    
    onFiltersChange({
      ...currentFilters,
      file_type: newTypes.length > 0 ? newTypes : undefined
    });
  };

  const handleDateRangeChange = (field: 'date_from' | 'date_to', date: Date | undefined) => {
    onFiltersChange({
      ...currentFilters,
      [field]: date ? date.toISOString().split('T')[0] : undefined
    });
  };

  const clearAllFilters = () => {
    setSearchValue('');
    onFiltersChange({});
    onSearchChange('');
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (currentFilters.search) count++;
    if (currentFilters.status?.length) count += currentFilters.status.length;
    if (currentFilters.file_type?.length) count += currentFilters.file_type.length;
    if (currentFilters.date_from || currentFilters.date_to) count++;
    return count;
  };

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-800' },
    { value: 'analyzing', label: 'Analyzing', color: 'bg-blue-100 text-blue-800' },
    { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
    { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800' },
  ];

  const fileTypeOptions = [
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'Word Document' },
    { value: 'txt', label: 'Text File' },
    { value: 'xlsx', label: 'Excel' },
    { value: 'pptx', label: 'PowerPoint' },
    { value: 'html', label: 'HTML' },
    { value: 'md', label: 'Markdown' },
  ];

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          ref={searchInputRef}
          placeholder="Search documents by filename or content..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 pr-4"
          disabled={isLoading}
        />
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="w-4 h-4 mr-2" />
              Status
              {currentFilters.status?.length ? (
                <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                  {currentFilters.status.length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filter by Status</h4>
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`status-${option.value}`}
                    checked={currentFilters.status?.includes(option.value) || false}
                    onChange={() => handleStatusFilter(option.value)}
                    className="rounded border-gray-300"
                  />
                  <label 
                    htmlFor={`status-${option.value}`} 
                    className="text-sm cursor-pointer flex-1"
                  >
                    <Badge className={option.color}>
                      {option.label}
                    </Badge>
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* File Type Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              File Type
              {currentFilters.file_type?.length ? (
                <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                  {currentFilters.file_type.length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filter by File Type</h4>
              {fileTypeOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`type-${option.value}`}
                    checked={currentFilters.file_type?.includes(option.value) || false}
                    onChange={() => handleFileTypeFilter(option.value)}
                    className="rounded border-gray-300"
                  />
                  <label 
                    htmlFor={`type-${option.value}`} 
                    className="text-sm cursor-pointer"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Date Range Filter */}
        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Date Range
              {(currentFilters.date_from || currentFilters.date_to) ? (
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
                  <label className="text-xs text-gray-600">From</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      // Date picker implementation would go here
                      // For brevity, using a simple approach
                    }}
                  >
                    {currentFilters.date_from 
                      ? format(new Date(currentFilters.date_from), 'MMM d, yyyy')
                      : 'Select date'
                    }
                  </Button>
                </div>
                
                <div>
                  <label className="text-xs text-gray-600">To</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      // Date picker implementation would go here
                    }}
                  >
                    {currentFilters.date_to 
                      ? format(new Date(currentFilters.date_to), 'MMM d, yyyy')
                      : 'Select date'
                    }
                  </Button>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeChange('date_from', undefined)}
                  disabled={!currentFilters.date_from}
                >
                  Clear From
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeChange('date_to', undefined)}
                  disabled={!currentFilters.date_to}
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
            className="h-8 text-gray-600"
          >
            <X className="w-4 h-4 mr-1" />
            Clear All ({getActiveFilterCount()})
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2">
          {currentFilters.search && (
            <Badge variant="secondary" className="px-2 py-1">
              Search: "{currentFilters.search}"
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
                onClick={() => handleSearchChange('')}
              />
            </Badge>
          )}
          
          {currentFilters.status?.map((status) => (
            <Badge key={status} variant="secondary" className="px-2 py-1">
              Status: {status}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
                onClick={() => handleStatusFilter(status)}
              />
            </Badge>
          ))}
          
          {currentFilters.file_type?.map((type) => (
            <Badge key={type} variant="secondary" className="px-2 py-1">
              Type: {type}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
                onClick={() => handleFileTypeFilter(type)}
              />
            </Badge>
          ))}
          
          {(currentFilters.date_from || currentFilters.date_to) && (
            <Badge variant="secondary" className="px-2 py-1">
              Date: {currentFilters.date_from || '...'} to {currentFilters.date_to || '...'}
              <X 
                className="w-3 h-3 ml-1 cursor-pointer" 
                onClick={() => onFiltersChange({
                  ...currentFilters,
                  date_from: undefined,
                  date_to: undefined
                })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}