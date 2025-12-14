import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SmartTemplate } from '@/services/template-service';

interface TemplateViewerProps {
  template: (SmartTemplate & { type: 'smart' }) & { description?: string; tags?: string[]; template_content?: string };
}

export const TemplateViewer: React.FC<TemplateViewerProps> = ({ template }) => {
  return (
    <div className="space-y-6">
      {/* Template Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {template.name}
            <Badge variant="secondary">Smart Template</Badge>
          </CardTitle>
          <p className="text-muted-foreground">{template.description || ''}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Category:</span> {template.category}
            </div>
            <div>
              <span className="font-medium">Usage Count:</span> {template.usage_count || 0}
            </div>
            <div>
              <span className="font-medium">Variables:</span> {template.smart_variables?.length || 0}
            </div>
            <div>
              <span className="font-medium">Public:</span> {template.is_public ? 'Yes' : 'No'}
            </div>
          </div>
          {template.tags && template.tags.length > 0 && (
            <div className="mt-4">
              <span className="font-medium text-sm">Tags:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {template.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Variables (AI-Powered + Regex Fallback)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Variables are extracted using AI first, with regex patterns as fallback
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {template.smart_variables?.map((variable) => (
              <div
                key={variable.id}
                className="border border-border rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{variable.name}</h4>
                  <Badge variant="outline">{variable.type}</Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">
                  {variable.description}
                </p>
                
                {variable.extraction_hints && variable.extraction_hints.length > 0 && (
                  <div className="mb-3">
                    <span className="text-sm font-medium">AI Extraction Hints:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {variable.extraction_hints.map((hint, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {hint}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {variable.regex_fallback && (
                  <div className="mt-3">
                    <span className="text-sm font-medium">Regex Fallback:</span>
                    <code className="block text-xs bg-muted p-2 rounded mt-1 font-mono">
                      {variable.regex_fallback}
                    </code>
                  </div>
                )}
                
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  {Boolean(variable.confidence_threshold) && (
                    <span>Min Confidence: {variable.confidence_threshold}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template Content */}
      <Card>
        <CardHeader>
          <CardTitle>Template Content</CardTitle>
          <p className="text-sm text-muted-foreground">
            Template for generating new documents using extracted variables
          </p>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-muted p-4 rounded-lg whitespace-pre-wrap overflow-x-auto">
            {template.template_content || 'No template content defined'}
          </pre>
        </CardContent>
      </Card>

      {/* Generation Settings */}
      {template.generation_settings && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded-lg">
              {JSON.stringify(template.generation_settings, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};