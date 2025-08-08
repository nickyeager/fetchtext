import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, Check, AlertCircle, Bot, Server, Cloud, Zap } from 'lucide-react'
import { aiService } from '@/lib/services/ai-service'
import { toast } from 'sonner'
import ModelSelector from './model-selector'
import ProviderSelector from './provider-selector'

export default function AIModelsSettings() {
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const queryClient = useQueryClient()

  // Fetch available providers
  const {
    data: providersData,
    isLoading: isLoadingProviders,
    error: providersError,
    refetch: refetchProviders
  } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => aiService.getProviders(),
    retry: 2,
    staleTime: 30000, // 30 seconds
  })

  // Fetch available models
  const {
    data: modelsData,
    isLoading: isLoadingModels,
    error: modelsError,
    refetch: refetchModels
  } = useQuery({
    queryKey: ['ai-models', providersData?.current_provider],
    queryFn: () => aiService.getAvailableModels(),
    enabled: !!providersData,
    retry: 2,
    staleTime: 30000, // 30 seconds
  })

  // Set active provider mutation
  const setActiveProviderMutation = useMutation({
    mutationFn: (provider: string) => aiService.setActiveProvider(provider),
    onSuccess: (data) => {
      toast.success(`Switched to ${data.provider}`)
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] })
      queryClient.invalidateQueries({ queryKey: ['ai-models'] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to change provider: ${error.message}`)
    }
  })

  // Set active model mutation
  const setActiveModelMutation = useMutation({
    mutationFn: (modelName: string) => aiService.setActiveModel(modelName),
    onSuccess: (data) => {
      toast.success(`Model changed to ${data.model}`)
      queryClient.invalidateQueries({ queryKey: ['ai-models'] })
      setSelectedModel('')
    },
    onError: (error: Error) => {
      toast.error(`Failed to change model: ${error.message}`)
    }
  })

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: () => aiService.testConnection(),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    },
    onError: (error: Error) => {
      toast.error(`Connection test failed: ${error.message}`)
    }
  })

  // Set initial selected values when data loads
  useEffect(() => {
    if (modelsData && !selectedModel) {
      setSelectedModel(modelsData.current_model)
    }
  }, [modelsData, selectedModel])

  useEffect(() => {
    if (providersData && !selectedProvider) {
      setSelectedProvider(providersData.current_provider)
    }
  }, [providersData, selectedProvider])

  const handleModelChange = () => {
    if (selectedModel && selectedModel !== modelsData?.current_model) {
      setActiveModelMutation.mutate(selectedModel)
    }
  }

  const handleProviderChange = (provider: string) => {
    if (provider !== providersData?.current_provider) {
      setSelectedProvider(provider)
      setActiveProviderMutation.mutate(provider)
    }
  }

  const handleRefresh = () => {
    refetchProviders()
    refetchModels()
    toast.info('Refreshing AI configuration...')
  }

  const handleTestConnection = () => {
    testConnectionMutation.mutate()
  }

  if (modelsError) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">AI Models</h3>
          <p className="text-sm text-muted-foreground">
            Manage your Ollama AI models for document processing.
          </p>
        </div>
        <Separator />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to connect to Ollama service. Please ensure the document processor is running and Ollama is available.
          </AlertDescription>
        </Alert>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">AI Models</h3>
        <p className="text-sm text-muted-foreground">
          Manage your AI providers and models for document processing.
        </p>
      </div>
      <Separator />

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Provider</CardTitle>
          <CardDescription>
            Choose between local Ollama models or cloud-based Azure OpenAI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProviders ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : providersData ? (
            <ProviderSelector
              providers={providersData.providers}
              selectedProvider={selectedProvider}
              onProviderChange={handleProviderChange}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Current Model Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Current Active Model</CardTitle>
            <CardDescription>
              The model currently being used for AI-powered document processing
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={handleTestConnection} 
              variant="outline" 
              size="sm"
              disabled={testConnectionMutation.isPending}
            >
              <Zap className={`mr-2 h-4 w-4 ${testConnectionMutation.isPending ? 'animate-pulse' : ''}`} />
              Test Integration
            </Button>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              disabled={isLoadingModels}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingModels ? (
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <span className="font-medium">{modelsData?.current_model || 'Unknown'}</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                {providersData?.current_provider === 'ollama' ? (
                  <><Server className="h-4 w-4" /> Ollama (Local)</>
                ) : (
                  <><Cloud className="h-4 w-4" /> Azure OpenAI</>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Model</CardTitle>
          <CardDescription>
            Select a different model from your available Ollama models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingModels ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <>
              <ModelSelector
                models={modelsData?.models || []}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                currentModel={modelsData?.current_model || ''}
              />
              
              {selectedModel && selectedModel !== modelsData?.current_model && (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      Ready to switch to <strong>{selectedModel}</strong>
                    </span>
                  </div>
                  <Button
                    onClick={handleModelChange}
                    disabled={setActiveModelMutation.isPending}
                    size="sm"
                  >
                    {setActiveModelMutation.isPending ? 'Applying...' : 'Apply Changes'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Available Models List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Models</CardTitle>
          <CardDescription>
            All Ollama models available on your system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingModels ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : modelsData?.models.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Bot className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No models found</p>
              <p className="text-sm">Install models using <code>ollama pull &lt;model-name&gt;</code></p>
            </div>
          ) : (
            <div className="space-y-2">
              {modelsData?.models.map((model) => (
                <div
                  key={model.name}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    model.name === modelsData.current_model
                      ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">
                        {aiService.getModelDisplayName(model)}
                      </span>
                      {model.name === modelsData.current_model && (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Size: {aiService.formatModelSize(model.size)}
                    </p>
                  </div>
                  <div className="text-right">
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {model.name}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}