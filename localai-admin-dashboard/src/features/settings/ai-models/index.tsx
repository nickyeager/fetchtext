import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Check, AlertCircle, Bot, Server, Cloud, Zap, Building2, Crown, Rocket, Shield, Sparkles } from 'lucide-react'
import { aiService } from '@/lib/services/ai-service'
import { useOrganization } from '@/context/organization-context'
import { LLM_TIERS } from '@/types/organization'
import { toast } from 'sonner'
import ModelSelector from './model-selector'
import ProviderSelector from './provider-selector'
import { ProvisioningStatus } from '@/components/provisioning/ProvisioningStatus'
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config'

export default function AIModelsSettings() {
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [enterpriseModel, setEnterpriseModel] = useState<string>('gpt-4o-mini')
  const [showUpgradeUI, setShowUpgradeUI] = useState(false)
  const queryClient = useQueryClient()
  const { activeOrganization, canManage } = useOrganization()

  // Fetch org's effective LLM config
  const {
    data: effectiveConfig,
    isLoading: isLoadingEffectiveConfig,
    refetch: refetchEffectiveConfig
  } = useQuery({
    queryKey: ['org-llm-config', activeOrganization?.id],
    queryFn: () => activeOrganization?.id
      ? aiService.getEffectiveLLMConfig(activeOrganization.id)
      : Promise.resolve(null),
    enabled: !!activeOrganization?.id,
    retry: 1,
    staleTime: 30000,
  })

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

  // Fetch provisioning status for enterprise tier
  const {
    data: provisioningStatus,
    refetch: refetchProvisioningStatus
  } = useQuery({
    queryKey: ['provisioning-status', activeOrganization?.id],
    queryFn: async () => {
      if (!activeOrganization?.id) return null
      const response = await fetch(
        `${DOCUMENT_PROCESSOR_URL}/models/provision/${activeOrganization.id}/status`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch provisioning status')
      }
      return response.json()
    },
    enabled: !!activeOrganization?.id && (effectiveConfig?.tier === 'enterprise' || showUpgradeUI),
    refetchInterval: (query) => {
      // Poll every 5 seconds while provisioning
      const status = query.state.data?.status
      if (status === 'provisioning' || status === 'pending') {
        return 5000
      }
      return false
    },
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

  // Provision enterprise instance mutation
  const provisionMutation = useMutation({
    mutationFn: async (model: string) => {
      if (!activeOrganization?.id) {
        throw new Error('No organization selected')
      }
      const response = await fetch(
        `${DOCUMENT_PROCESSOR_URL}/models/provision/${activeOrganization.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_model: model }),
        }
      )
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Provisioning failed')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Provisioning started! Your dedicated instance is being created.')
      setShowUpgradeUI(false)
      queryClient.invalidateQueries({ queryKey: ['provisioning-status'] })
      refetchProvisioningStatus()
    },
    onError: (error: Error) => {
      toast.error(`Provisioning failed: ${error.message}`)
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
    refetchEffectiveConfig()
    toast.info('Refreshing AI configuration...')
  }

  const handleTestConnection = () => {
    testConnectionMutation.mutate()
  }

  const handleStartProvisioning = () => {
    provisionMutation.mutate(enterpriseModel)
  }

  // Check if provisioning is in progress or active
  const isProvisioning = provisioningStatus?.status === 'provisioning' || provisioningStatus?.status === 'pending'
  const isProvisioningActive = provisioningStatus?.status === 'active'

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

      {/* Organization LLM Tier Status */}
      {activeOrganization && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  {activeOrganization.name} - AI Configuration
                </CardTitle>
              </div>
              {effectiveConfig && (
                <Badge variant={effectiveConfig.source === 'organization' ? 'default' : 'secondary'}>
                  {effectiveConfig.source === 'organization' ? (
                    <><Crown className="h-3 w-3 mr-1" /> Custom Config</>
                  ) : (
                    'System Default'
                  )}
                </Badge>
              )}
            </div>
            <CardDescription>
              Your organization's AI tier and usage status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEffectiveConfig ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : effectiveConfig ? (
              <div className="space-y-4">
                {/* Tier Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">
                        {LLM_TIERS[effectiveConfig.tier]?.name || effectiveConfig.tier}
                      </span>
                      {LLM_TIERS[effectiveConfig.tier]?.hasAI && (
                        <Badge variant="outline" className="text-xs">
                          <Bot className="h-3 w-3 mr-1" /> AI Enabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {LLM_TIERS[effectiveConfig.tier]?.description}
                    </p>
                  </div>
                </div>

                {/* Usage Limits (for non_managed tier) */}
                {effectiveConfig.has_usage_limits && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span>Daily Usage</span>
                      <span className={effectiveConfig.is_within_limits ? 'text-muted-foreground' : 'text-destructive font-medium'}>
                        {effectiveConfig.documents_today} / {effectiveConfig.daily_limit} documents
                      </span>
                    </div>
                    <Progress
                      value={effectiveConfig.daily_limit
                        ? (effectiveConfig.documents_today / effectiveConfig.daily_limit) * 100
                        : 0
                      }
                      className="h-2"
                    />

                    <div className="flex items-center justify-between text-sm">
                      <span>Monthly Usage</span>
                      <span className="text-muted-foreground">
                        {effectiveConfig.documents_month} / {effectiveConfig.monthly_limit} documents
                      </span>
                    </div>
                    <Progress
                      value={effectiveConfig.monthly_limit
                        ? (effectiveConfig.documents_month / effectiveConfig.monthly_limit) * 100
                        : 0
                      }
                      className="h-2"
                    />

                    {!effectiveConfig.is_within_limits && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Usage limit exceeded. Upgrade your plan for unlimited AI processing.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Upgrade prompt for non-managed tier */}
                {effectiveConfig.tier === 'non_managed' && canManage && !isProvisioning && !isProvisioningActive && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      Want unlimited AI processing with dedicated infrastructure?
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUpgradeUI(true)}
                    >
                      <Rocket className="h-4 w-4 mr-2" />
                      Upgrade to Enterprise
                    </Button>
                  </div>
                )}

                {/* Show provisioning status when in progress */}
                {(isProvisioning || isProvisioningActive) && activeOrganization?.id && (
                  <div className="pt-2 border-t">
                    <ProvisioningStatus
                      organizationId={activeOrganization.id}
                      onComplete={() => {
                        refetchEffectiveConfig()
                        queryClient.invalidateQueries({ queryKey: ['provisioning-status'] })
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Using system default AI configuration
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enterprise Upgrade Card */}
      {showUpgradeUI && canManage && (
        <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Upgrade to Enterprise</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUpgradeUI(false)}
              >
                Cancel
              </Button>
            </div>
            <CardDescription>
              Get a dedicated Azure OpenAI instance for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <Shield className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Data Isolation</p>
                  <p className="text-xs text-muted-foreground">Your own isolated Azure instance</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">No Usage Limits</p>
                  <p className="text-xs text-muted-foreground">Unlimited document processing</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <Sparkles className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Latest Models</p>
                  <p className="text-xs text-muted-foreground">GPT-4o and GPT-4o-mini</p>
                </div>
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select your AI model</label>
              <Select value={enterpriseModel} onValueChange={setEnterpriseModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">
                    <div className="flex flex-col">
                      <span>GPT-4o-mini (Recommended)</span>
                      <span className="text-xs text-muted-foreground">Fast and cost-effective</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    <div className="flex flex-col">
                      <span>GPT-4o</span>
                      <span className="text-xs text-muted-foreground">Most capable, higher cost</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provision Button */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleStartProvisioning}
                disabled={provisionMutation.isPending}
                className="w-full"
              >
                {provisionMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Starting Provisioning...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Provision My Instance
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Provisioning takes 2-5 minutes. You can continue using the app while we set up your instance.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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