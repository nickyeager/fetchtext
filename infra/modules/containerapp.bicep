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

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
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
              value: ''
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: []
      }
    }
  }
  tags: tags
}

output id string = containerApp.id
output fqdn string = containerApp.properties.configuration.ingress.fqdn
