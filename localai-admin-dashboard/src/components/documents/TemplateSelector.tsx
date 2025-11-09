/**
 * Template Selector Component
 * 
 * Allows users to:
 * - View template suggestions for a document
 * - Select the best template automatically
 * - Choose a specific template manually
 * - Change template for already processed documents
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Target, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Zap,
  Settings
} from 'lucide-react';
import { UnifiedDocumentService } from '@/services/unified-document-service';
import { toast } from 'sonner';

interface TemplateSuggestion {
  template_id: number;
  template_name: string;
  match_score: number;
  category: string;
  field_count: number;
}

interface TemplateSelectorProps {
  documentId: string;
  suggestions: TemplateSuggestion[];
  currentTemplateId?: number;
  currentTemplateName?: string;
  onTemplateApplied?: (templateId: number, templateName: string) => void;
  showChangeOption?: boolean;
}

export default function TemplateSelector({
  documentId,
  suggestions,
  currentTemplateId,
  currentTemplateName,
  onTemplateApplied,
  showChangeOption = false
}: TemplateSelectorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const queryClient = useQueryClient();

  // Auto-select best template mutation
  const selectBestTemplateMutation = useMutation({
    mutationFn: () => UnifiedDocumentService.selectBestTemplate(documentId),
    onSuccess: (data) => {
      toast.success('Best template selected and processing started!');
      queryClient.invalidateQueries({ queryKey: ['processedDocument', documentId] });
      if (onTemplateApplied && data.metadata?.template_id) {
        onTemplateApplied(data.metadata.template_id, data.metadata.template_name || '');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to select template: ${error.message}`);
    }
  });

  // Apply specific template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: ({ templateId, templateName }: { templateId: number; templateName: string }) => 
      UnifiedDocumentService.applyTemplateToDocument(documentId, templateId, templateName),
    onSuccess: (data) => {
      toast.success('Template applied and processing started!');
      queryClient.invalidateQueries({ queryKey: ['processedDocument', documentId] });
      setSelectedTemplateId('');
      if (onTemplateApplied && data.metadata?.template_id) {
        onTemplateApplied(data.metadata.template_id, data.metadata.template_name || '');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply template: ${error.message}`);
    }
  });

  // Change template mutation
  const changeTemplateMutation = useMutation({
    mutationFn: ({ templateId, templateName }: { templateId: number; templateName: string }) => 
      UnifiedDocumentService.changeDocumentTemplate(documentId, templateId, templateName),
    onSuccess: (data) => {
      toast.success('Template changed and re-processing started!');
      queryClient.invalidateQueries({ queryKey: ['processedDocument', documentId] });
      setSelectedTemplateId('');
      if (onTemplateApplied && data.metadata?.template_id) {
        onTemplateApplied(data.metadata.template_id, data.metadata.template_name || '');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to change template: ${error.message}`);
    }
  });

  const handleSelectBest = () => {
    selectBestTemplateMutation.mutate();
  };

  const handleApplySelected = () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template first');
      return;
    }

    const template = suggestions.find(s => s.template_id.toString() === selectedTemplateId);
    if (!template) {
      toast.error('Selected template not found');
      return;
    }

    if (showChangeOption && currentTemplateId) {
      changeTemplateMutation.mutate({
        templateId: template.template_id,
        templateName: template.template_name
      });
    } else {
      applyTemplateMutation.mutate({
        templateId: template.template_id,
        templateName: template.template_name
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 dark:text-green-400';
    if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 0.8) return 'default';
    if (score >= 0.6) return 'secondary';
    return 'outline';
  };

  if (suggestions.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No template suggestions available for this document.
        </AlertDescription>
      </Alert>
    );
  }

  const bestTemplate = suggestions.sort((a, b) => b.match_score - a.match_score)[0];
  const isProcessing = selectBestTemplateMutation.isPending || 
                      applyTemplateMutation.isPending || 
                      changeTemplateMutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          {showChangeOption ? 'Change Template' : 'Template Selection Required'}
        </CardTitle>
        {currentTemplateId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-3 w-3" />
            Current: {currentTemplateName || `Template ${currentTemplateId}`}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-select best template */}
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Recommended: {bestTemplate.template_name}</span>
              <Badge variant={getScoreBadgeVariant(bestTemplate.match_score)} className="text-xs">
                {Math.round(bestTemplate.match_score * 100)}% match
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Category: {bestTemplate.category} • {bestTemplate.field_count} fields
            </p>
          </div>
          <Button
            onClick={handleSelectBest}
            disabled={isProcessing}
            size="sm"
            className="ml-4"
          >
            <Zap className="h-3 w-3 mr-1" />
            {showChangeOption ? 'Switch to Best' : 'Use Best'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 border-t" />
          <span className="text-xs text-muted-foreground px-2">OR</span>
          <div className="flex-1 border-t" />
        </div>

        {/* Manual template selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings className="h-4 w-4" />
            Choose Manually
          </div>

          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {suggestions.map((template) => (
                <SelectItem key={template.template_id} value={template.template_id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <span>{template.template_name}</span>
                    <Badge 
                      variant={getScoreBadgeVariant(template.match_score)} 
                      className="ml-2 text-xs"
                    >
                      {Math.round(template.match_score * 100)}%
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleApplySelected}
            disabled={!selectedTemplateId || isProcessing}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                {showChangeOption ? 'Changing Template...' : 'Applying Template...'}
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 mr-2" />
                {showChangeOption ? 'Change Template' : 'Apply Template'}
              </>
            )}
          </Button>
        </div>

        {/* Template suggestions list */}
        <div className="space-y-2">
          <Separator />
          <div className="text-sm font-medium">All Suggestions</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {suggestions.map((template, index) => (
              <div
                key={template.template_id}
                className={`flex items-center justify-between p-2 border rounded text-sm ${
                  template.template_id === bestTemplate.template_id
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.template_name}</span>
                    {template.template_id === bestTemplate.template_id && (
                      <Badge variant="secondary" className="text-xs">
                        Best Match
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {template.category} • {template.field_count} fields
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-medium text-sm ${getScoreColor(template.match_score)}`}>
                    {Math.round(template.match_score * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}