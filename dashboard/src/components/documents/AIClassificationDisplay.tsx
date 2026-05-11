import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Tag, 
  Target, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { AIClassification } from '@/lib/enhanced-document-processor'

interface AIClassificationDisplayProps {
  classification: AIClassification
  showDetails?: boolean
  className?: string
}

export function AIClassificationDisplay({ 
  classification, 
  showDetails = true,
  className = ""
}: AIClassificationDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 border-green-200'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4 text-green-600" />
    if (confidence >= 0.6) return <AlertCircle className="w-4 h-4 text-yellow-600" />
    return <AlertCircle className="w-4 h-4 text-red-600" />
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'business_report': 'bg-blue-100 text-blue-800 border-blue-200',
      'technical_document': 'bg-purple-100 text-purple-800 border-purple-200',
      'legal_contract': 'bg-red-100 text-red-800 border-red-200',
      'financial_statement': 'bg-green-100 text-green-800 border-green-200',
      'invoice': 'bg-orange-100 text-orange-800 border-orange-200',
      'form': 'bg-gray-100 text-gray-800 border-gray-200',
      'presentation': 'bg-pink-100 text-pink-800 border-pink-200',
      'research_paper': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'manual': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'correspondence': 'bg-teal-100 text-teal-800 border-teal-200',
    }
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const formatCategoryName = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const confidencePercentage = Math.round(classification.confidence_score * 100)

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">AI Document Classification</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {getConfidenceIcon(classification.confidence_score)}
            <Badge className={getConfidenceColor(classification.confidence_score)}>
              {confidencePercentage}% Confidence
            </Badge>
          </div>
        </div>
        <CardDescription>
          Intelligent document analysis and categorization
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Primary Classification */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Document Type</span>
            </h4>
            <Badge className={getCategoryColor(classification.primary_category)}>
              {formatCategoryName(classification.primary_category)}
            </Badge>
          </div>

          {/* Confidence Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Classification Confidence</span>
              <span className="font-medium">{confidencePercentage}%</span>
            </div>
            <Progress value={confidencePercentage} className="h-2" />
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Content Type</span>
              <p className="font-medium capitalize">{classification.content_type}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Complexity</span>
              <p className="font-medium capitalize">{classification.complexity_level}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Industry</span>
              <p className="font-medium capitalize">{classification.industry_domain}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Method</span>
              <p className="font-medium">
                {classification.classification_method === 'ai_powered' ? 'AI Powered' : 'Rule Based'}
              </p>
            </div>
          </div>
        </div>

        {/* Document Purpose */}
        {classification.document_purpose && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Document Purpose</span>
            </h4>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              {classification.document_purpose}
            </p>
          </div>
        )}

        {/* Key Topics */}
        {classification.key_topics && classification.key_topics.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center space-x-2">
              <Tag className="w-4 h-4" />
              <span>Key Topics</span>
            </h4>
            <div className="flex flex-wrap gap-1">
              {classification.key_topics.slice(0, 5).map((topic, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {topic}
                </Badge>
              ))}
              {classification.key_topics.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{classification.key_topics.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Secondary Categories */}
        {classification.secondary_categories && classification.secondary_categories.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Secondary Categories</h4>
            <div className="flex flex-wrap gap-1">
              {classification.secondary_categories.map((category, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {formatCategoryName(category)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Information (Collapsible) */}
        {showDetails && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center space-x-2">
                  <Info className="w-4 h-4" />
                  <span>Detailed Analysis</span>
                </span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 mt-4">
              {/* Extraction Recommendations */}
              {classification.extraction_recommendations && (
                <div className="space-y-3">
                  <h5 className="font-medium flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>Processing Recommendations</span>
                  </h5>
                  
                  <div className="space-y-3 text-sm">
                    {/* Key Data Points */}
                    {classification.extraction_recommendations.key_data_points && 
                     classification.extraction_recommendations.key_data_points.length > 0 && (
                      <div>
                        <span className="text-muted-foreground font-medium">Key Data Points:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {classification.extraction_recommendations.key_data_points.map((point, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {point}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structure Patterns */}
                    {classification.extraction_recommendations.structure_patterns && 
                     classification.extraction_recommendations.structure_patterns.length > 0 && (
                      <div>
                        <span className="text-muted-foreground font-medium">Structure Patterns:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {classification.extraction_recommendations.structure_patterns.map((pattern, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {pattern}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Processing Priority */}
                    {classification.extraction_recommendations.processing_priority && (
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground font-medium">Processing Priority:</span>
                        <Badge 
                          className={
                            classification.extraction_recommendations.processing_priority === 'high' 
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : classification.extraction_recommendations.processing_priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              : 'bg-green-100 text-green-800 border-green-200'
                          }
                        >
                          {classification.extraction_recommendations.processing_priority}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Metadata */}
              <div className="space-y-2 text-sm">
                <h5 className="font-medium flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Classification Metadata</span>
                </h5>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Language:</span>
                    <p className="font-medium capitalize">{classification.language || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Formality:</span>
                    <p className="font-medium capitalize">{classification.formality_level || 'Unknown'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Analyzed:</span>
                    <p className="font-medium">
                      {new Date(classification.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}