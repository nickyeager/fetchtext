import React, { useState, useCallback, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, ExternalLink, CheckCircle, XCircle, Upload, Settings, AlertCircle } from 'lucide-react';
import { 
  googleDocsIntegration, 
  GoogleDocLoadRequest, 
  GoogleDocLoadResponse,
  GoogleDocsIntegrationService 
} from '@/services/google-docs-integration';

interface GoogleDocsLoaderProps {
  onDocumentLoaded?: (response: GoogleDocLoadResponse) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface LoadingState {
  isLoading: boolean;
  progress: number;
  currentOperation: string;
}

export function GoogleDocsLoader({ onDocumentLoaded, onError, className }: GoogleDocsLoaderProps) {
  const [docUrl, setDocUrl] = useState('');
  const [exportFormat, setExportFormat] = useState('text/plain');
  const [processImmediately, setProcessImmediately] = useState(true);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    progress: 0,
    currentOperation: ''
  });
  const [results, setResults] = useState<GoogleDocLoadResponse[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [integrationConfigured, setIntegrationConfigured] = useState<boolean | null>(null);

  const supportedFormats = GoogleDocsIntegrationService.getSupportedExportFormats();

  // Check if Google Drive integration is configured
  useEffect(() => {
    const checkIntegrationStatus = () => {
      try {
        const settingsJson = localStorage.getItem('google_drive_settings');
        if (!settingsJson) {
          setIntegrationConfigured(false);
          return;
        }
        
        const settings = JSON.parse(settingsJson);
        const isConfigured = settings.enabled && (
          (settings.auth_method === 'oauth2' && settings.client_id && settings.client_secret) ||
          (settings.auth_method === 'service_account' && settings.service_account_key && settings.service_account_email)
        );
        
        setIntegrationConfigured(isConfigured);
      } catch (error) {
        console.error('Failed to check integration status:', error);
        setIntegrationConfigured(false);
      }
    };

    checkIntegrationStatus();
    
    // Listen for storage changes (when user updates settings)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'google_drive_settings') {
        checkIntegrationStatus();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const extractDocumentId = useCallback((url: string) => {
    return GoogleDocsIntegrationService.extractDocumentId(url);
  }, []);

  const validateInput = useCallback(() => {
    if (!docUrl.trim()) {
      setErrors(['Please enter a Google Docs URL or document ID']);
      return false;
    }

    const documentId = extractDocumentId(docUrl.trim());
    if (!documentId) {
      setErrors(['Invalid Google Docs URL format. Please provide a valid Google Docs URL or document ID']);
      return false;
    }

    setErrors([]);
    return true;
  }, [docUrl, extractDocumentId]);

  const handleLoadDocument = useCallback(async () => {
    if (!validateInput()) return;

    const documentId = extractDocumentId(docUrl.trim());
    if (!documentId) return;

    setLoadingState({ 
      isLoading: true, 
      progress: 10, 
      currentOperation: 'Validating document access...' 
    });

    try {
      // Step 1: Validate document access
      const validation = await googleDocsIntegration.validateDocumentAccess(documentId);
      if (!validation.valid) {
        throw new Error(validation.error || 'Document access validation failed');
      }

      setLoadingState({ 
        isLoading: true, 
        progress: 30, 
        currentOperation: 'Downloading document from Google Docs...' 
      });

      // Step 2: Load the document
      const request: GoogleDocLoadRequest = {
        document_id: documentId,
        export_format: exportFormat as any,
        process_immediately: processImmediately
      };

      const response = await googleDocsIntegration.loadGoogleDoc(request);

      if (response.success) {
        setLoadingState({ 
          isLoading: true, 
          progress: processImmediately ? 80 : 100, 
          currentOperation: processImmediately ? 'Processing document with AI...' : 'Complete' 
        });

        if (processImmediately) {
          // Simulate AI processing time
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        setLoadingState({ 
          isLoading: false, 
          progress: 100, 
          currentOperation: 'Document loaded successfully' 
        });

        setResults(prev => [response, ...prev]);
        setDocUrl(''); // Clear input after successful load
        onDocumentLoaded?.(response);
      } else {
        throw new Error(response.error || 'Failed to load document');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrors([errorMessage]);
      setLoadingState({ 
        isLoading: false, 
        progress: 0, 
        currentOperation: '' 
      });
      onError?.(errorMessage);
    }
  }, [docUrl, exportFormat, processImmediately, validateInput, extractDocumentId, onDocumentLoaded, onError]);

  const handleBatchLoad = useCallback(async () => {
    // Parse multiple URLs/IDs from textarea input
    const urls = docUrl.split('\n').map(url => url.trim()).filter(Boolean);
    if (urls.length === 0) {
      setErrors(['Please enter at least one Google Docs URL']);
      return;
    }

    setLoadingState({ 
      isLoading: true, 
      progress: 0, 
      currentOperation: `Loading ${urls.length} documents...` 
    });

    try {
      const requests: GoogleDocLoadRequest[] = [];
      
      for (const url of urls) {
        const documentId = extractDocumentId(url);
        if (!documentId) {
          setErrors(prev => [...prev, `Invalid URL format: ${url}`]);
          continue;
        }

        requests.push({
          document_id: documentId,
          export_format: exportFormat as any,
          process_immediately: processImmediately
        });
      }

      if (requests.length === 0) {
        throw new Error('No valid document URLs found');
      }

      const responses = await googleDocsIntegration.loadMultipleGoogleDocs(requests);
      
      setLoadingState({ 
        isLoading: false, 
        progress: 100, 
        currentOperation: 'Batch loading complete' 
      });

      const successful = responses.filter(r => r.success);
      const failed = responses.filter(r => !r.success);

      setResults(prev => [...successful, ...prev]);
      
      if (failed.length > 0) {
        setErrors(failed.map(r => `${r.google_doc_id}: ${r.error}`));
      }

      setDocUrl(''); // Clear input after batch load
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch loading failed';
      setErrors([errorMessage]);
      setLoadingState({ 
        isLoading: false, 
        progress: 0, 
        currentOperation: '' 
      });
      onError?.(errorMessage);
    }
  }, [docUrl, exportFormat, processImmediately, extractDocumentId, onError]);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Load Google Docs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Integration Status Warning */}
          {integrationConfigured === false && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  Google Drive integration is not configured. Please set up your API credentials first.
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings/integrations">
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {integrationConfigured === true && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Google Drive integration is configured and ready to use.
              </AlertDescription>
            </Alert>
          )}

          {/* Input Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-url">Google Docs URL or Document ID</Label>
              <Input
                id="doc-url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/YOUR_DOC_ID/edit or just the document ID"
                disabled={loadingState.isLoading || integrationConfigured === false}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                For batch loading, enter multiple URLs separated by new lines
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="export-format">Export Format</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedFormats.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        <div>
                          <div className="font-medium">{format.label}</div>
                          <div className="text-xs text-muted-foreground">{format.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Processing Options</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="process-immediately"
                    checked={processImmediately}
                    onCheckedChange={(checked) => setProcessImmediately(!!checked)}
                    disabled={loadingState.isLoading}
                  />
                  <Label htmlFor="process-immediately" className="text-sm">
                    Process with AI immediately
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loadingState.isLoading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{loadingState.currentOperation}</span>
              </div>
              <Progress value={loadingState.progress} className="w-full" />
            </div>
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleLoadDocument}
              disabled={loadingState.isLoading || !docUrl.trim() || integrationConfigured === false}
              className="flex-1"
            >
              {loadingState.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Load Document
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleBatchLoad}
              disabled={loadingState.isLoading || !docUrl.trim() || integrationConfigured === false}
            >
              Batch Load
            </Button>
          </div>

          {/* Results Section */}
          {results.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Recently Loaded Documents</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {results.slice(0, 5).map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-mono">{result.google_doc_id}</span>
                        {result.processed_at && (
                          <Badge variant="secondary" className="text-xs">
                            AI Processed
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {result.processed_at ? 
                          new Date(result.processed_at).toLocaleTimeString() :
                          result.downloaded_at ? 
                          new Date(result.downloaded_at).toLocaleTimeString() : 
                          'Just now'
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}