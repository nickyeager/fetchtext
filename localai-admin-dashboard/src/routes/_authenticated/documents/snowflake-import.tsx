/**
 * Snowflake Import Page
 *
 * Full-page route for browsing and importing documents from Snowflake Stages.
 * Combines StageBrowser (database > schema > stage selection) with
 * StageFileBrowser (file listing and batch processing).
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Snowflake, ArrowLeft, Settings, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useOrganization } from '@/context/organization-context'
import {
  integrationService,
  integrationKeys,
} from '@/lib/services/integration-service'
import { StageBrowser } from '@/components/snowflake/StageBrowser'
import { StageFileBrowser } from '@/components/snowflake/StageFileBrowser'
import type { SnowflakeStage } from '@/lib/services/snowflake-service'

export const Route = createFileRoute(
  '/_authenticated/documents/snowflake-import'
)({
  component: SnowflakeImportPage,
})

function SnowflakeImportPage() {
  const { activeOrganization } = useOrganization()
  const navigate = useNavigate()
  const [selectedStage, setSelectedStage] = useState<SnowflakeStage | null>(
    null
  )

  // Check Snowflake connection status
  const { data: snowflakeStatus, isLoading } = useQuery({
    queryKey: integrationKeys.status(
      activeOrganization?.id || '',
      'snowflake'
    ),
    queryFn: () =>
      integrationService.getIntegrationStatus(
        activeOrganization!.id,
        'snowflake'
      ),
    enabled: !!activeOrganization?.id,
  })

  const isConnected = snowflakeStatus?.status === 'connected'

  if (!activeOrganization) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Organization Selected</AlertTitle>
          <AlertDescription>
            Please select an organization from the sidebar to import from
            Snowflake.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Snowflake className="h-5 w-5 animate-pulse" />
          Checking Snowflake connection...
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Snowflake className="h-5 w-5" />
              Connect Snowflake
            </CardTitle>
            <CardDescription>
              You need to connect your Snowflake account before importing
              documents from stages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() =>
                navigate({ to: '/settings/integrations' })
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              Go to Integration Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/documents' })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-semibold">
              Import from Snowflake
            </h1>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left panel: Stage browser */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Browse Stages</CardTitle>
            <CardDescription className="text-xs">
              Select a database, schema, and stage to browse files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StageBrowser
              organizationId={activeOrganization.id}
              onStageSelect={setSelectedStage}
            />
          </CardContent>
        </Card>

        {/* Right panel: File browser */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {selectedStage
                ? `Files in ${selectedStage.name}`
                : 'Select a Stage'}
            </CardTitle>
            {selectedStage && (
              <CardDescription className="text-xs">
                {selectedStage.database_name}.{selectedStage.schema_name}.
                {selectedStage.name}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedStage ? (
              <StageFileBrowser
                organizationId={activeOrganization.id}
                stageName={
                  selectedStage.database_name
                    ? `${selectedStage.database_name}.${selectedStage.schema_name}.${selectedStage.name}`
                    : selectedStage.name
                }
                onProcess={() => {
                  // Could navigate to gallery or show success
                }}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Select a stage from the left panel to view its files
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
