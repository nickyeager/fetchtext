param name string
param environmentId string
param location string
param image string
@minValue(0)
param minReplicas int
@minValue(1)
param maxReplicas int
@description('vCPU for container app (e.g., 0.25, 0.5, 1). Provide as string; converted with json().')
param cpu string
@description('Memory in Gi (e.g., 1, 1.5, 2). Provide as string.')
param memory string
param registryServer string
param userAssignedIdentityId string
param tags object = {}
param keyVaultUri string
param supabaseSecretNames object

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
  tags: tags
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 8090
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: registryServer
          identity: userAssignedIdentityId
        }
      ]
      secrets: [
        {
          name: supabaseSecretNames.url
          identity: userAssignedIdentityId
          keyVaultUrl: format('{0}secrets/{1}', keyVaultUri, supabaseSecretNames.url)
        }
        {
          name: supabaseSecretNames.anon
          identity: userAssignedIdentityId
          keyVaultUrl: format('{0}secrets/{1}', keyVaultUri, supabaseSecretNames.anon)
        }
        {
          name: supabaseSecretNames.serviceRole
          identity: userAssignedIdentityId
          keyVaultUrl: format('{0}secrets/{1}', keyVaultUri, supabaseSecretNames.serviceRole)
        }
        {
          name: supabaseSecretNames.dbConnection
          identity: userAssignedIdentityId
          keyVaultUrl: format('{0}secrets/{1}', keyVaultUri, supabaseSecretNames.dbConnection)
        }
      ]
    }
    template: {
      revisionSuffix: 'v1'
      containers: [
        {
          name: name
          image: image
          resources: {
            cpu: json(cpu)
            memory: '${memory}Gi'
          }
          env: [
            {
              name: 'SUPABASE_URL'
              secretRef: supabaseSecretNames.url
            }
            {
              name: 'SUPABASE_ANON_KEY'
              secretRef: supabaseSecretNames.anon
            }
            {
              name: 'ANON_KEY'
              secretRef: supabaseSecretNames.anon
            }
            {
              name: 'SERVICE_ROLE_KEY'
              secretRef: supabaseSecretNames.serviceRole
            }
            {
              name: 'SUPABASE_SERVICE_ROLE_KEY'
              secretRef: supabaseSecretNames.serviceRole
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output id string = containerApp.id
output fqdn string = containerApp.properties.configuration.ingress.fqdn
