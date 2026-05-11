/**
 * StageBrowser Component
 *
 * Hierarchical browser for Snowflake stages.
 * Database dropdown -> Schema dropdown -> Stage list (cards).
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Database, FolderOpen, Loader2, Snowflake } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  snowflakeService,
  snowflakeKeys,
  type SnowflakeStage,
} from '@/lib/services/snowflake-service'

interface StageBrowserProps {
  organizationId: string
  onStageSelect: (stage: SnowflakeStage) => void
}

export function StageBrowser({
  organizationId,
  onStageSelect,
}: StageBrowserProps) {
  const [selectedDatabase, setSelectedDatabase] = useState<string>('')
  const [selectedSchema, setSelectedSchema] = useState<string>('')

  // Fetch databases
  const { data: databases, isLoading: loadingDatabases } = useQuery({
    queryKey: snowflakeKeys.databases(organizationId),
    queryFn: () => snowflakeService.listDatabases(organizationId),
  })

  // Fetch schemas (depends on selected database)
  const { data: schemas, isLoading: loadingSchemas } = useQuery({
    queryKey: snowflakeKeys.schemas(organizationId, selectedDatabase),
    queryFn: () =>
      snowflakeService.listSchemas(organizationId, selectedDatabase),
    enabled: !!selectedDatabase,
  })

  // Fetch stages (depends on selected database + schema)
  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: snowflakeKeys.stages(
      organizationId,
      selectedDatabase,
      selectedSchema
    ),
    queryFn: () =>
      snowflakeService.listStages(
        organizationId,
        selectedDatabase || undefined,
        selectedSchema || undefined
      ),
    enabled: !!selectedDatabase && !!selectedSchema,
  })

  return (
    <div className="space-y-4">
      {/* Database selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Database
        </Label>
        <Select
          value={selectedDatabase}
          onValueChange={(value) => {
            setSelectedDatabase(value)
            setSelectedSchema('')
          }}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                loadingDatabases ? 'Loading...' : 'Select a database'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {databases?.map((db) => (
              <SelectItem key={db.name} value={db.name}>
                {db.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Schema selector */}
      {selectedDatabase && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Schema
          </Label>
          <Select
            value={selectedSchema}
            onValueChange={setSelectedSchema}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  loadingSchemas ? 'Loading...' : 'Select a schema'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {schemas?.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stage list */}
      {selectedSchema && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Snowflake className="h-4 w-4" />
            Stages
          </Label>
          {loadingStages ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stages...
            </div>
          ) : stages && stages.length > 0 ? (
            <div className="grid gap-2">
              {stages.map((stage) => (
                <Card
                  key={stage.name}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => onStageSelect(stage)}
                >
                  <CardHeader className="p-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Snowflake className="h-4 w-4 text-blue-500" />
                        {stage.name}
                      </span>
                      {stage.type && (
                        <Badge variant="outline" className="text-xs">
                          {stage.type}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              No stages found in {selectedDatabase}.{selectedSchema}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
