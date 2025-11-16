param location string = resourceGroup().location
param environment string = 'dev'
param tags object = {
  Environment: environment
}

// Frontend (Static Web App)
@description('Unique name for the Static Web App.')
param staticWebAppName string = 'ft-${toLower(environment)}-dashboard-${toLower(substring(uniqueString(subscription().id, resourceGroup().name, toLower(environment)), 0, 6))}'

// Backend (Container App)
@description('Container App name.')
param containerAppName string = 'ft-${toLower(environment)}-document-processor-${toLower(substring(uniqueString(subscription().id, resourceGroup().name, toLower(environment)), 0, 6))}'
@description('Azure Container Apps environment name.')
param containerAppEnvName string = 'ft-${toLower(environment)}-cae-${toLower(substring(uniqueString(subscription().id, resourceGroup().name, toLower(environment)), 0, 6))}'
@description('Fully qualified image reference (ACR login server/image:tag).')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'
@minValue(0)
param containerAppMinReplicas int = 0
@maxValue(10)
param containerAppMaxReplicas int = 3
@description('vCPU for container app (e.g., 0.25, 0.5, 1, 2). Provide as string; converted to number in module.')
param containerAppCpu string = '0.5'
@description('Memory in Gi for container app (e.g., 1, 1.5, 2). Provide as string; used as text with Gi suffix.')
param containerAppMemory string = '1.0'

// Registry
@description('Azure Container Registry name (must be globally unique, 5-50 alphanumeric).')
param acrName string = toLower('ft${toLower(environment)}${toLower(substring(uniqueString(subscription().id, resourceGroup().name, toLower(environment)), 0, 6))}acr')

// Monitoring
@description('Log Analytics workspace name.')
param logAnalyticsName string = 'ft-${toLower(environment)}-law-${toLower(substring(uniqueString(subscription().id, resourceGroup().name, toLower(environment)), 0, 6))}'

// Secrets
@description('Key Vault name for application secrets.')
param keyVaultName string = toLower('ft${toLower(environment)}${toLower(substring(uniqueString(subscription().id, resourceGroup().name, toLower(environment)), 0, 6))}kv')

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

// Grant the container app's user-assigned identity permission to pull images from ACR
resource acrExisting 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  // Name must be deterministically calculable at start-time; avoid principalId in name
  name: guid(subscription().id, resourceGroup().name, acrName, containerAppName, 'acrpull')
  scope: acrExisting
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: managedIdentity.outputs.principalId
    principalType: 'ServicePrincipal'
  }
  dependsOn: [
    containerRegistry
    managedIdentity
  ]
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
    tags: union(tags, {
      'azd-service-name': 'document-processor'
    })
  }
}

module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'swa-${staticWebAppName}'
  params: {
    name: staticWebAppName
    location: 'Central US' // Static Web Apps ignores RG location; must be one of the supported regions.
    sku: staticWebAppSku
    tags: union(tags, {
      'azd-service-name': 'dashboard'
    })
    customDomains: staticWebAppCustomDomains
  }
}

output keyVaultUri string = keyVault.outputs.vaultUri
output containerAppFqdn string = containerApp.outputs.fqdn
output staticWebAppHostname string = staticWebApp.outputs.hostname
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
// Explicit env var for azure.yaml registry interpolation
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
