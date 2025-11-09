import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { AlertCircle, CheckCircle, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const googleDriveSettingsSchema = z.object({
  enabled: z.boolean(),
  auth_method: z.enum(['oauth2', 'service_account']),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  service_account_email: z.string().email().optional(),
  service_account_key: z.string().optional(),
  project_id: z.string().optional(),
})

type GoogleDriveSettingsValues = z.infer<typeof googleDriveSettingsSchema>

export function GoogleDriveSettings() {
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [showServiceKey, setShowServiceKey] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing' | 'error'>('disconnected')
  const [lastTested, setLastTested] = useState<string | null>(null)

  const form = useForm<GoogleDriveSettingsValues>({
    resolver: zodResolver(googleDriveSettingsSchema),
    defaultValues: {
      enabled: false,
      auth_method: 'oauth2',
    },
  })

  const watchAuthMethod = form.watch('auth_method')
  const watchEnabled = form.watch('enabled')

  // Load saved settings on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('google_drive_settings')
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        form.reset(settings)
        if (settings.enabled && (settings.client_id || settings.service_account_key)) {
          setConnectionStatus('connected')
          setLastTested(settings.last_tested || null)
        }
      } catch (error) {
        console.error('Failed to load Google Drive settings:', error)
      }
    }
  }, [form])

  const onSubmit = async (data: GoogleDriveSettingsValues) => {
    try {
      // Save settings to localStorage
      const settingsToSave = {
        ...data,
        last_tested: new Date().toISOString(),
      }
      localStorage.setItem('google_drive_settings', JSON.stringify(settingsToSave))
      
      // Test connection if enabled
      if (data.enabled) {
        await testConnection(data)
      }
      
      // Success notification would go here
      console.log('Google Drive settings saved successfully')
    } catch (error) {
      console.error('Failed to save Google Drive settings:', error)
      setConnectionStatus('error')
    }
  }

  const testConnection = async (settings: GoogleDriveSettingsValues) => {
    setConnectionStatus('testing')
    
    try {
      // Mock connection test - in real implementation, this would call the backend
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate success/failure based on whether credentials are provided
      const hasCredentials = settings.auth_method === 'oauth2' 
        ? settings.client_id && settings.client_secret
        : settings.service_account_key && settings.service_account_email
      
      if (hasCredentials) {
        setConnectionStatus('connected')
        setLastTested(new Date().toISOString())
      } else {
        setConnectionStatus('error')
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnectionStatus('error')
    }
  }

  const handleTestConnection = () => {
    const currentValues = form.getValues()
    testConnection(currentValues)
  }

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>
      case 'testing':
        return <Badge className="bg-blue-100 text-blue-800">Testing...</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Not Connected</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Google Drive Integration
              {getStatusBadge()}
            </CardTitle>
            <CardDescription>
              Configure Google Drive API access for document loading and processing
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Enable/Disable Integration */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Google Drive Integration
                    </FormLabel>
                    <FormDescription>
                      Allow the application to access Google Drive documents using your API credentials
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchEnabled && (
              <>
                {/* Authentication Method Selection */}
                <FormField
                  control={form.control}
                  name="auth_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication Method</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4">
                          <Card 
                            className={`cursor-pointer transition-colors ${field.value === 'oauth2' ? 'ring-2 ring-blue-500' : ''}`}
                            onClick={() => field.onChange('oauth2')}
                          >
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <h4 className="font-medium">OAuth2 (Recommended)</h4>
                                <p className="text-sm text-muted-foreground">
                                  Access documents you have permission to view
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                          <Card 
                            className={`cursor-pointer transition-colors ${field.value === 'service_account' ? 'ring-2 ring-blue-500' : ''}`}
                            onClick={() => field.onChange('service_account')}
                          >
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <h4 className="font-medium">Service Account</h4>
                                <p className="text-sm text-muted-foreground">
                                  Access documents shared with service account
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Choose how the application will authenticate with Google Drive
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {/* OAuth2 Credentials */}
                {watchAuthMethod === 'oauth2' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">OAuth2 Credentials</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://console.cloud.google.com/apis/credentials', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Get Credentials
                      </Button>
                    </div>
                    
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Create OAuth2 credentials in the Google Cloud Console. Set the redirect URI to: 
                        <code className="mx-1 p-1 bg-gray-100 rounded">http://localhost:3000/auth/google/callback</code>
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client ID</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123456789.apps.googleusercontent.com"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your Google OAuth2 Client ID
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_secret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Secret</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showClientSecret ? "text" : "password"}
                                placeholder="GOCSPX-..."
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowClientSecret(!showClientSecret)}
                              >
                                {showClientSecret ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Your Google OAuth2 Client Secret
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Service Account Credentials */}
                {watchAuthMethod === 'service_account' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">Service Account</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://console.cloud.google.com/iam-admin/serviceaccounts', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Create Service Account
                      </Button>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Create a service account in Google Cloud Console and download the JSON key file. 
                        Documents must be shared with the service account email to be accessible.
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={form.control}
                      name="service_account_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Account Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="service-account@project-id.iam.gserviceaccount.com"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            The email address of your service account
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="service_account_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Account Key (JSON)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Textarea
                                placeholder="Paste the entire JSON key file content here..."
                                className="min-h-32 font-mono text-xs"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-2"
                                onClick={() => setShowServiceKey(!showServiceKey)}
                              >
                                {showServiceKey ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            The private key JSON file downloaded from Google Cloud Console
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Project ID */}
                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Cloud Project ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="my-project-id"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The ID of your Google Cloud Project where APIs are enabled
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Connection Status and Test */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Connection Status</p>
                    <div className="flex items-center gap-2">
                      {getStatusBadge()}
                      {lastTested && (
                        <span className="text-xs text-muted-foreground">
                          Last tested: {new Date(lastTested).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                  >
                    {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
              </>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={!watchEnabled}>
                Save Settings
              </Button>
            </div>
          </form>
        </Form>

        {/* Setup Instructions */}
        {watchEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h4 className="font-medium">Required Google Cloud APIs:</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Google Drive API</li>
                  <li>• Google Docs API</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Required OAuth Scopes:</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• https://www.googleapis.com/auth/drive.readonly</li>
                  <li>• https://www.googleapis.com/auth/documents.readonly</li>
                </ul>
              </div>

              {watchAuthMethod === 'service_account' && (
                <div className="space-y-2">
                  <h4 className="font-medium">Document Sharing:</h4>
                  <p className="text-sm text-muted-foreground">
                    Share documents with your service account email to make them accessible for processing.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}