param location string = resourceGroup().location
param environment string = 'dev'
param tags object = {
  Environment: environment
}

// Frontend (Static Web App)
@description('Unique name for the Static Web App.')
param staticWebAppName string

// Backend (Container App)
@description('Container App name.')
param containerAppName string
@description('Azure Container Apps environment name.')
param containerAppEnvName string = '${environment}-cae'
@description('Fully qualified image reference (ACR login server/image:tag).')
param containerImage string
@minValue(0)
param containerAppMinReplicas int = 0
@maxValue(10)
param containerAppMaxReplicas int = 3
@minValue(0.25)
@maxValue(2)
param containerAppCpu double = 0.5
@minValue(0.5)
@maxValue(4)
param containerAppMemory double = 1.0

// Registry
@description('Azure Container Registry name (must be globally unique, 5-50 alphanumeric).')
param acrName string

// Monitoring
@description('Log Analytics workspace name.')
param logAnalyticsName string = '${environment}-law'

// Secrets
@description('Key Vault name for application secrets.')
param keyVaultName string = '${environment}-kv'

// Static Web App plan
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSku string = 'Standard'

// The deployment principal must have permission to set Key Vault access policies.
@description('Object ID of the principal (user/service principal) running this deployment. Used for temporary Key Vault access.')
param deploymentPrincipalObjectId string

// Optional custom domain bindings
@description('Optional Static Web App custom domain names.')
param staticWebAppCustomDomains array = []

// === Modules ===

module logAnalytics 'modules/logging.bicep' = {
  name: 'logAnalytics-${logAnalyticsName}'
  params: {
    name: logAnalyticsName
    location: location
    tags: tags
  }
}

module containerEnv 'modules/containerapp-environment.bicep' = {
  name: 'containerEnv-${containerAppEnvName}'
  params: {
    name: containerAppEnvName
    location: location
    logAnalyticsId: logAnalytics.outputs.id
    logAnalyticsCustomerId: logAnalytics.outputs.customerId
    logAnalyticsSharedKey: logAnalytics.outputs.sharedKey
    tags: tags
  }
}

module containerRegistry 'modules/acr.bicep' = {
  name: 'acr-${acrName}'
  params: {
    name: acrName
    location: location
    tags: tags
  }
}

module managedIdentity 'modules/managed-identity.bicep' = {
  name: 'mi-${containerAppName}'
  params: {
    name: '${containerAppName}-mi'
    location: location
    tags: tags
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'kv-${keyVaultName}'
  params: {
    name: keyVaultName
    location: location
    tenantId: subscription().tenantId
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: deploymentPrincipalObjectId
        permissions: {
          secrets: [
            'Get'
            'List'
            'Set'
            'Delete'
          ]
        }
      }
      {
        tenantId: subscription().tenantId
        objectId: managedIdentity.outputs.principalId
        permissions: {
          secrets: [
            'Get'
            'List'
          ]
        }
      }
    ]
    tags: tags
  }
  dependsOn: [
    managedIdentity
  ]
}

module containerApp 'modules/containerapp.bicep' = {
  name: 'ca-${containerAppName}'
  params: {
    name: containerAppName
    environmentId: containerEnv.outputs.id
    location: location
    image: containerImage
    minReplicas: containerAppMinReplicas
    maxReplicas: containerAppMaxReplicas
    cpu: containerAppCpu
    memory: containerAppMemory
    userAssignedIdentityId: managedIdentity.outputs.id
    registryServer: containerRegistry.outputs.loginServer
    tags: tags
  }
}

module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'swa-${staticWebAppName}'
  params: {
    name: staticWebAppName
    location: 'Central US' // Static Web Apps ignores RG location; must be one of the supported regions.
    sku: staticWebAppSku
    tags: tags
    customDomains: staticWebAppCustomDomains
  }
}

output keyVaultUri string = keyVault.outputs.vaultUri
output containerAppFqdn string = containerApp.outputs.fqdn
output staticWebAppHostname string = staticWebApp.outputs.hostname
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
