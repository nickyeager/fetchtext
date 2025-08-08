import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Cloud, Server } from 'lucide-react'
import { type ProviderInfo } from '@/lib/services/ai-service'

interface ProviderSelectorProps {
  providers: ProviderInfo[]
  selectedProvider: string
  onProviderChange: (provider: string) => void
}

export default function ProviderSelector({
  providers,
  selectedProvider,
  onProviderChange
}: ProviderSelectorProps) {
  const getProviderIcon = (name: string) => {
    switch (name) {
      case 'ollama':
        return <Server className="h-4 w-4" />
      case 'azure_openai':
        return <Cloud className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <RadioGroup value={selectedProvider} onValueChange={onProviderChange}>
      <div className="space-y-3">
        {providers.map((provider) => (
          <div key={provider.name} className="flex items-start space-x-3">
            <RadioGroupItem
              value={provider.name}
              id={provider.name}
              disabled={!provider.configured}
              className="mt-1"
            />
            <Label
              htmlFor={provider.name}
              className={`flex-1 cursor-pointer ${
                !provider.configured ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getProviderIcon(provider.name)}
                  <span className="font-medium">{provider.display_name}</span>
                </div>
                {!provider.configured && (
                  <Badge variant="outline" className="text-xs">
                    Not Configured
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {provider.name === 'ollama' && 
                  'Use local AI models running on your infrastructure'
                }
                {provider.name === 'azure_openai' && 
                  'Use Azure-hosted GPT models for enhanced capabilities'
                }
              </p>
            </Label>
          </div>
        ))}
      </div>
    </RadioGroup>
  )
}