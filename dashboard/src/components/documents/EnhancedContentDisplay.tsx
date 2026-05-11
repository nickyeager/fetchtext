import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  FileText, 
  Database, 
  BarChart3, 
  Settings, 
  ChevronDown, 
  ChevronUp,
  Download,
  Copy,
  Eye,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { EnhancedProcessedDocument } from '@/lib/enhanced-document-processor'

interface EnhancedContentDisplayProps {
  document: EnhancedProcessedDocument
  className?: string
}

export function EnhancedContentDisplay({ 
  document, 
  className = ""
}: EnhancedContentDisplayProps) {
  const [activeTab, setActiveTab] = useState('content')
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false)

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'high':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case 'low':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      default:
        return <Info className="w-4 h-4 text-gray-600" />
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  const formatProcessingTime = (time: number) => {
    return time < 1 ? `${Math.round(time * 1000)}ms` : `${time.toFixed(2)}s`
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Enhanced Document Analysis</span>
            </CardTitle>
            <CardDescription>
              AI-powered content extraction and analysis results
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {document.processing_method.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge className={document.ai_enhancement_enabled ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
              {document.ai_enhancement_enabled ? 'AI Enhanced' : 'Basic Processing'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <div className="space-y-4">
              {/* Content Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Document Content</h4>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(document.content.text)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-64 w-full border rounded-md p-4">
                  <pre className="text-sm whitespace-pre-wrap">
                    {document.content.text}
                  </pre>
                </ScrollArea>
              </div>

              {/* Structure Analysis */}
              {document.content.ai_structure_analysis && (
                <div className="space-y-2">
                  <h4 className="font-medium">AI Structure Analysis</h4>
                  <div className="bg-muted p-4 rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Enhancement Applied</span>
                      <Badge className={document.content.ai_structure_analysis.enhancement_applied ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {document.content.ai_structure_analysis.enhancement_applied ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    
                    {document.content.ai_structure_analysis.detected_patterns && (
                      <div>
                        <span className="text-sm font-medium">Detected Patterns:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {document.content.ai_structure_analysis.detected_patterns.map((pattern, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {pattern}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Confidence:</span>
                      <Progress 
                        value={document.content.ai_structure_analysis.confidence * 100} 
                        className="flex-1 h-2" 
                      />
                      <span className="text-sm">
                        {Math.round(document.content.ai_structure_analysis.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tables and Images Summary */}
              <div className="grid grid-cols-2 gap-4">
                {document.content.tables && document.content.tables.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Tables Found</h5>
                    <div className="text-sm text-muted-foreground">
                      {document.content.tables.length} table(s) detected
                    </div>
                  </div>
                )}
                
                {document.content.images && document.content.images.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Images Found</h5>
                    <div className="text-sm text-muted-foreground">
                      {document.content.images.length} image(s) detected
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Extracted Data Tab */}
          <TabsContent value="extracted" className="space-y-4">
            {document.extracted_data ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Extracted Data</h4>
                  <Badge variant="outline">
                    {document.extracted_data.extraction_method.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                {/* Extraction Summary */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Method</span>
                    <p className="font-medium">{document.extracted_data.extraction_method}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Data Points</span>
                    <p className="font-medium">{document.extracted_data.target_data_points.length}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Overall Confidence</span>
                    <p className="font-medium">{Math.round(document.extracted_data.overall_confidence * 100)}%</p>
                  </div>
                </div>

                {/* Extracted Values */}
                {Object.keys(document.extracted_data.extracted_values).length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium">Extracted Values</h5>
                    <div className="space-y-2">
                      {Object.entries(document.extracted_data.extracted_values).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="space-y-1">
                            <span className="font-medium text-sm">{key}</span>
                            <p className="text-sm text-muted-foreground">{String(value)}</p>
                          </div>
                          {document.extracted_data!.confidence_scores[key] && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(document.extracted_data!.confidence_scores[key] * 100)}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extraction Notes */}
                {document.extracted_data.extraction_notes && (
                  <div className="space-y-2">
                    <h5 className="font-medium">Extraction Notes</h5>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      {document.extracted_data.extraction_notes}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No extracted data available</p>
                <p className="text-sm">Enable AI enhancement for data extraction</p>
              </div>
            )}
          </TabsContent>

          {/* Quality Assessment Tab */}
          <TabsContent value="quality" className="space-y-4">
            {document.quality_assessment ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Content Quality Assessment</h4>
                  <div className="flex items-center space-x-2">
                    {getQualityIcon(document.quality_assessment.overall_quality)}
                    <Badge className={getQualityColor(document.quality_assessment.overall_quality)}>
                      {document.quality_assessment.overall_quality.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Quality Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Completeness</span>
                        <span>{Math.round(document.quality_assessment.completeness_score * 100)}%</span>
                      </div>
                      <Progress value={document.quality_assessment.completeness_score * 100} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Readability</span>
                        <span>{Math.round(document.quality_assessment.readability_score * 100)}%</span>
                      </div>
                      <Progress value={document.quality_assessment.readability_score * 100} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Structure</span>
                        <span>{Math.round(document.quality_assessment.structure_score * 100)}%</span>
                      </div>
                      <Progress value={document.quality_assessment.structure_score * 100} className="h-2" />
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Word Count</span>
                      <p className="text-2xl font-bold">{document.quality_assessment.word_count.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Quality Insights */}
                {document.quality_assessment.insights && document.quality_assessment.insights.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium">Quality Insights</h5>
                    <div className="space-y-1">
                      {document.quality_assessment.insights.map((insight, index) => (
                        <div key={index} className="flex items-start space-x-2 text-sm">
                          <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                          <span className="text-muted-foreground">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No quality assessment available</p>
                <p className="text-sm">Enable quality assessment for detailed metrics</p>
              </div>
            )}
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="space-y-4">
            <div className="space-y-4">
              <h4 className="font-medium">Document Metadata</h4>
              
              {/* Basic Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Filename</span>
                    <p className="font-medium">{document.metadata.filename}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">File Size</span>
                    <p className="font-medium">{(document.metadata.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium">{document.metadata.document_type}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">Title</span>
                    <p className="font-medium">{document.metadata.title}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MIME Type</span>
                    <p className="font-medium">{document.metadata.mime_type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Processing Time</span>
                    <p className="font-medium">{formatProcessingTime(document.processing_time)}</p>
                  </div>
                </div>
              </div>

              {/* Processing Information */}
              <Collapsible open={isMetadataExpanded} onOpenChange={setIsMetadataExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center space-x-2">
                      <Settings className="w-4 h-4" />
                      <span>Processing Details</span>
                    </span>
                    {isMetadataExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Job ID</span>
                      <p className="font-mono text-xs">{document.job_id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status</span>
                      <p className="font-medium capitalize">{document.status}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created</span>
                      <p className="font-medium">
                        {new Date(document.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed</span>
                      <p className="font-medium">
                        {new Date(document.completed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {document.ai_processing_time && (
                    <div>
                      <span className="text-muted-foreground">AI Processing Time</span>
                      <p className="font-medium">{formatProcessingTime(document.ai_processing_time)}</p>
                    </div>
                  )}

                  {document.request_metadata && (
                    <div className="space-y-2">
                      <span className="text-muted-foreground font-medium">Processing Options</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(document.request_metadata.processing_options).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                            <Badge variant={value ? "default" : "secondary"} className="text-xs">
                              {value ? "Yes" : "No"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}