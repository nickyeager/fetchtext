import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config'

export default function DeveloperSettings() {
  const [copied, setCopied] = useState(false)
  const baseUrl = DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'

  const handleCopy = () => {
    navigator.clipboard.writeText(baseUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Developer</h3>
        <p className="text-sm text-muted-foreground">
          API documentation, endpoints, and developer resources.
        </p>
      </div>
      <Separator />

      {/* API Base URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Base URL</CardTitle>
          <CardDescription>
            The base URL for the document processor backend API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
              {baseUrl}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Documentation Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Documentation</CardTitle>
          <CardDescription>
            Interactive API reference and testing tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href={`${baseUrl}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
          >
            <div>
              <p className="font-medium text-sm">ReDoc</p>
              <p className="text-xs text-muted-foreground">
                Clean, readable API reference documentation
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>

          <a
            href={`${baseUrl}/swagger`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
          >
            <div>
              <p className="font-medium text-sm">Swagger UI</p>
              <p className="text-xs text-muted-foreground">
                Interactive API explorer — try endpoints directly
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>

          <a
            href={`${baseUrl}/openapi.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
          >
            <div>
              <p className="font-medium text-sm">OpenAPI Spec</p>
              <p className="text-xs text-muted-foreground">
                Download the OpenAPI 3.x JSON specification
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
