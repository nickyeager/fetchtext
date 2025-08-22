import { useState, useCallback } from 'react';
import { createFileRoute, useNavigate, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Filter, LayoutGrid, List, Zap, Workflow, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { masterTemplateService } from '@/services/master-template-service';
import { UnifiedTemplate, TemplateFilters } from '@/types/unified-template';
import { AuthDebugPanel } from '@/components/debug/AuthDebugPanel';

interface TemplatesPageSearch {
  view?: 'grid' | 'list';
  type?: 'all' | 'smart' | 'standard' | 'workflow';
  category?: string;
  search?: string;
}

export const Route = createFileRoute('/_authenticated/templates')({
  validateSearch: (search: Record<string, unknown>): TemplatesPageSearch => ({
    view: (search.view as 'grid' | 'list') || 'grid',
    type: (search.type as 'all' | 'smart' | 'standard' | 'workflow') || 'all',
    category: search.category as string,
    search: search.search as string,
  }),
  component: UnifiedTemplatesPage,
});

export function UnifiedTemplatesPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  
  // State management
  const [searchQuery, setSearchQuery] = useState(searchParams.search || '');
  
  // Build filters from search params
  const filters: TemplateFilters = {
    type: searchParams.type === 'all' ? undefined : [searchParams.type as 'smart' | 'standard' | 'workflow'],
    category: searchParams.category && searchParams.category !== 'all' ? [searchParams.category] : undefined,
    search: searchQuery,
    sort_by: 'updated_at',
    sort_order: 'desc'
  };
  
  // Fetch templates
  const {
    data: templates = [],
    isLoading
  } = useQuery({
    queryKey: ['templates', filters],
    queryFn: () => masterTemplateService.getTemplates(filters),
  });
  
  // Update URL params when filters change
  const updateSearchParams = useCallback((updates: Partial<TemplatesPageSearch>) => {
    navigate({
      to: '.',
      search: { ...searchParams, ...updates },
      replace: true,
    });
  }, [navigate, searchParams]);
  
  // Handle template selection - navigate to view route
  const handleSelectTemplate = useCallback((template: UnifiedTemplate) => {
    console.log('Templates Gallery: handleSelectTemplate called', { 
      template: template.id, 
      type: template.type, 
      name: template.name 
    });
    
    if (template.type === 'smart') {
      console.log('Current location before navigation:', window.location.href);
      console.log('Attempting to navigate with template ID:', template.id);
      
      // Try alternative navigation approach
      try {
        navigate({ 
          to: '/templates/smart/$templateId', 
          params: { templateId: template.id.toString() },
          replace: false
        });
        console.log('Navigate function called successfully');
        
        // Log URL change after navigation
        setTimeout(() => {
          console.log('URL after navigation:', window.location.href);
        }, 100);
      } catch (error) {
        console.error('Navigate function threw error:', error);
      }
    } else {
      const route = '/templates/$templateId';
      const params = { templateId: template.id.toString() };
      console.log('Templates Gallery: Navigating to standard template view', { route, params });
      navigate({ 
        to: route, 
        params 
      });
    }
  }, [navigate]);
  
  // Handle create new template - navigate to create routes (to be implemented)
  const handleCreateTemplate = useCallback((type: 'smart' | 'standard' | 'workflow') => {
    // TODO: Implement create routes
    toast.success(`Creating ${type} template - feature coming soon`);
  }, []);
  
  

  
  // Main templates gallery view
  return (
    <>
      {/* Render child routes if they exist */}
      <Outlet />
      

      {/* Only render gallery if we're at the base /templates route */}
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Templates</h1>
            <p className="text-muted-foreground mt-1">
              Manage all your templates in one place
            </p>
          </div>
          
          {/* Create Template Dropdown */}
          <Select onValueChange={(value) => handleCreateTemplate(value as 'smart' | 'standard' | 'workflow')}>
            <SelectTrigger className="w-[200px]">
              <Plus className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Create Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smart">Smart Template</SelectItem>
              <SelectItem value="standard">Standard Template</SelectItem>
              <SelectItem value="workflow">Workflow Template</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateSearchParams({ search: searchQuery });
                }
              }}
              className="max-w-md"
            />
          </div>
          
          <div className="flex gap-2">
            <Select
              value={searchParams.type || 'all'}
              onValueChange={(value) => updateSearchParams({ type: value as 'all' | 'smart' | 'standard' | 'workflow' })}
            >
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="smart">Smart</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
              </SelectContent>
            </Select>
            
            <Select
              value={searchParams.category || ''}
              onValueChange={(value) => updateSearchParams({ category: value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="report">Report</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateSearchParams({ view: searchParams.view === 'grid' ? 'list' : 'grid' })}
            >
              {searchParams.view === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {/* Templates Display */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg text-muted-foreground mb-4">No templates found</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Create your first template to get started with document processing, workflows, or standard templates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={searchParams.view === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
            : "space-y-4"
          }>
            {templates.map((template) => (
              <TemplateCard
                key={`${template.type}-${template.id}`}
                template={template}
                view={searchParams.view || 'grid'}
                onClick={() => handleSelectTemplate(template)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Template Card Component
function TemplateCard({ 
  template, 
  view, 
  onClick 
}: { 
  template: UnifiedTemplate; 
  view: 'grid' | 'list';
  onClick: () => void;
}) {
  const getIcon = () => {
    switch (template.type) {
      case 'smart': return <Zap className="h-5 w-5 text-yellow-500" />;
      case 'workflow': return <Workflow className="h-5 w-5 text-blue-500" />;
      default: return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };
  
  if (view === 'list') {
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div>
              <h3 className="font-medium">{template.name}</h3>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{template.category}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          {getIcon()}
          <Badge variant="outline" className="text-xs">
            {template.type}
          </Badge>
        </div>
        <CardTitle className="text-lg">{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <Badge variant="secondary">{template.category}</Badge>
        </div>
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {template.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
