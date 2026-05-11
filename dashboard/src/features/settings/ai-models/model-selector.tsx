import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Bot } from 'lucide-react'
import { aiService, type AIModel } from '@/lib/services/ai-service'

interface ModelSelectorProps {
  models: AIModel[]
  selectedModel: string
  onModelChange: (model: string) => void
  currentModel: string
}

export default function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  currentModel
}: ModelSelectorProps) {
  if (models.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 border-2 border-dashed rounded-lg">
        <div className="text-center">
          <Bot className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No models available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Install models using <code>ollama pull &lt;model-name&gt;</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Select value={selectedModel} onValueChange={onModelChange} data-testid="model-select">
        <SelectTrigger data-testid="model-select-trigger" aria-label="Model Selector">
          <SelectValue placeholder="Select a model">
            {selectedModel && (
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4" />
                <span>{aiService.getModelDisplayName(
                  models.find(m => m.name === selectedModel) || { name: selectedModel } as AIModel
                )}</span>
                {selectedModel === currentModel && (
                  <Badge variant="secondary" className="text-xs">
                    Current
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
  <SelectContent data-testid="model-select-content">
          {models.map((model) => (
            <SelectItem key={model.name} value={model.name} data-testid={`model-option-${model.name}`}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">
                        {aiService.getModelDisplayName(model)}
                      </span>
                      {model.name === currentModel && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {aiService.formatModelSize(model.size)}
                    </div>
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedModel && (
        <div className="text-xs text-muted-foreground">
          Full model name: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
            {selectedModel}
          </code>
        </div>
      )}
    </div>
  )
}