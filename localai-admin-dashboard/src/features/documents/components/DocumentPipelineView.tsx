/**
 * Document Pipeline Visualization
 * Shows the complete transformation: Template → Extraction → Output
 *
 * Design Philosophy: Bold, editorial layout with clear visual hierarchy
 * Typography: Distinctive fonts for different content types
 * Color: Vibrant accent colors to highlight the transformation stages
 */

import React from 'react';
import { FileText, ArrowRight, Sparkles, CheckCircle2, AlertCircle, Edit, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface PipelineStage {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface ExtractedField {
  name: string;
  value: string;
  confidence?: number;
  source: 'ai' | 'regex' | 'manual';
}

interface DocumentPipelineViewProps {
  templateContent: string;
  templateVariables: string[];
  extractedFields: Record<string, any>;
  confidenceScores?: Record<string, number>;
  finalOutput: string;
  documentName?: string;
  templateName?: string;
  templateId?: number | string;
  templateUpdatedAt?: string;
  onUpdateTemplate?: () => void;
}

export function DocumentPipelineView({
  templateContent,
  templateVariables,
  extractedFields,
  confidenceScores = {},
  finalOutput,
  documentName,
  templateName,
  templateId,
  templateUpdatedAt,
  onUpdateTemplate,
}: DocumentPipelineViewProps) {
  const [expandedStages, setExpandedStages] = React.useState({
    template: true,
    extraction: true,
    output: true,
  });

  // Parse extracted fields into structured format
  const parsedFields: ExtractedField[] = templateVariables.map((varName) => {
    const fieldData = extractedFields[varName];
    let value = '';
    let confidence = confidenceScores[varName];

    if (typeof fieldData === 'object' && fieldData !== null && 'value' in fieldData) {
      value = String(fieldData.value || '');
      if ('confidence' in fieldData && typeof fieldData.confidence === 'number') {
        confidence = fieldData.confidence;
      }
    } else {
      value = String(fieldData || '');
    }

    // Determine source based on confidence or presence
    let source: 'ai' | 'regex' | 'manual' = 'manual';
    if (confidence !== undefined) {
      source = confidence > 0.7 ? 'ai' : 'regex';
    }

    return { name: varName, value, confidence, source };
  });

  // Pipeline stages configuration
  const stages: PipelineStage[] = [
    {
      label: 'Template',
      icon: <FileText className="w-5 h-5" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    },
    {
      label: 'Extraction',
      icon: <Sparkles className="w-5 h-5" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'Output',
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
  ];

  // Highlight template variables in content
  const highlightVariables = (content: string, variables: string[]) => {
    let highlighted = content;
    variables.forEach((varName) => {
      const regex = new RegExp(`{{${varName}}}`, 'g');
      highlighted = highlighted.replace(
        regex,
        `<mark class="bg-amber-200 dark:bg-amber-800 px-1 py-0.5 rounded font-mono text-sm">${'{{'}${varName}${'}}'}}</mark>`
      );
    });
    return highlighted;
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined) return null;

    const percentage = Math.round(confidence * 100);
    let variant: 'default' | 'secondary' | 'destructive' = 'secondary';
    let text = `${percentage}%`;

    if (percentage >= 85) {
      variant = 'default';
      text = `${percentage}% High`;
    } else if (percentage >= 70) {
      variant = 'secondary';
      text = `${percentage}% Medium`;
    } else {
      variant = 'destructive';
      text = `${percentage}% Low`;
    }

    return (
      <Badge variant={variant} className="text-xs">
        {text}
      </Badge>
    );
  };

  const getSourceBadge = (source: 'ai' | 'regex' | 'manual') => {
    const config = {
      ai: { label: 'AI', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
      regex: { label: 'Pattern', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      manual: { label: 'Manual', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    };

    const { label, className } = config[source];
    return <Badge className={`text-xs ${className}`}>{label}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Pipeline Header */}
      <div className="relative">
        {/* Document Info Banner */}
        <div className="mb-6 p-6 rounded-xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Document Processing Pipeline</h2>
              <p className="text-muted-foreground">
                Visualizing the transformation from template structure to final document output
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              {documentName && (
                <p className="text-sm font-medium text-primary">{documentName}</p>
              )}
              {templateName && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Template: {templateName}</p>
                    {onUpdateTemplate && (
                      <Button
                        onClick={onUpdateTemplate}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Update Template
                      </Button>
                    )}
                  </div>
                  {templateUpdatedAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Last updated: {new Date(templateUpdatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {templateId && (
                    <Badge variant="secondary" className="text-xs">
                      ID: {templateId}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline Flow Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.label}>
              <div className={`flex flex-col items-center justify-center p-4 rounded-lg ${stage.bgColor}`}>
                <div className={`${stage.color} mb-2`}>{stage.icon}</div>
                <span className="text-sm font-semibold">{stage.label}</span>
              </div>
              {index < stages.length - 1 && (
                <div className="hidden lg:flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Three-Column Pipeline View */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Stage 1: Template Structure */}
        <Collapsible
          open={expandedStages.template}
          onOpenChange={(open) => setExpandedStages((prev) => ({ ...prev, template: open }))}
        >
          <Card className="h-full border-2 border-indigo-200 dark:border-indigo-800">
            <CardHeader className="bg-indigo-50 dark:bg-indigo-950/30">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                  <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                    <FileText className="w-5 h-5" />
                    1. Template Structure
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {templateVariables.length} variables
                  </Badge>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      Template Content
                    </p>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-96 text-sm leading-relaxed font-mono"
                      dangerouslySetInnerHTML={{
                        __html: highlightVariables(templateContent, templateVariables),
                      }}
                    />
                  </div>

                  {/* Variable List */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                      Defined Variables
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {templateVariables.map((varName) => (
                        <Badge key={varName} variant="secondary" className="font-mono text-xs">
                          {`{{${varName}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stage 2: Extraction Mapping */}
        <Collapsible
          open={expandedStages.extraction}
          onOpenChange={(open) => setExpandedStages((prev) => ({ ...prev, extraction: open }))}
        >
          <Card className="h-full border-2 border-amber-200 dark:border-amber-800">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/30">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                  <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Sparkles className="w-5 h-5" />
                    2. Field Extraction
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {parsedFields.filter((f) => f.value).length}/{parsedFields.length} extracted
                  </Badge>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Variable → Extracted Value Mapping
                  </p>

                  {/* Extraction Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Variable</TableHead>
                          <TableHead className="font-semibold">Extracted Value</TableHead>
                          <TableHead className="text-right font-semibold">Quality</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedFields.map((field) => (
                          <TableRow key={field.name}>
                            <TableCell className="font-mono text-xs font-semibold align-top">
                              {`{{${field.name}}}`}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              {field.value ? (
                                <span className="text-sm">{field.value}</span>
                              ) : (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <AlertCircle className="w-3 h-3" />
                                  <span className="text-xs italic">Not extracted</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right align-top">
                              <div className="flex flex-col items-end gap-1">
                                {getConfidenceBadge(field.confidence)}
                                {getSourceBadge(field.source)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Extraction Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Extraction Rate</p>
                      <p className="text-xl font-bold">
                        {Math.round((parsedFields.filter((f) => f.value).length / parsedFields.length) * 100)}%
                      </p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Avg Confidence</p>
                      <p className="text-xl font-bold">
                        {parsedFields.filter((f) => f.confidence).length > 0
                          ? Math.round(
                              (parsedFields.reduce((sum, f) => sum + (f.confidence || 0), 0) /
                                parsedFields.filter((f) => f.confidence).length) *
                                100
                            )
                          : 'N/A'}
                        {parsedFields.filter((f) => f.confidence).length > 0 && '%'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stage 3: Final Output */}
        <Collapsible
          open={expandedStages.output}
          onOpenChange={(open) => setExpandedStages((prev) => ({ ...prev, output: open }))}
        >
          <Card className="h-full border-2 border-emerald-200 dark:border-emerald-800">
            <CardHeader className="bg-emerald-50 dark:bg-emerald-950/30">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                  <CardTitle className="text-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5" />
                    3. Generated Output
                  </CardTitle>
                  <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Complete
                  </Badge>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      Final Document
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-96 text-sm leading-relaxed">
                      {finalOutput}
                    </div>
                  </div>

                  {/* Success Indicator */}
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                        Document Generated Successfully
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                        All template variables have been replaced with extracted values
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Pipeline Summary */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Pipeline Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Template Variables</p>
                <p className="text-2xl font-bold">{templateVariables.length}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Fields Extracted</p>
                <p className="text-2xl font-bold">{parsedFields.filter((f) => f.value).length}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Completion Rate</p>
                <p className="text-2xl font-bold">
                  {Math.round((parsedFields.filter((f) => f.value).length / parsedFields.length) * 100)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
