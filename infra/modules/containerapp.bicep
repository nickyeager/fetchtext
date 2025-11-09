param name string
param environmentId string
param location string
param image string
@minValue(0)
param minReplicas int
@minValue(1)
param maxReplicas int
@minValue(0.25)
param cpu double
@minValue(0.5)
param memory double
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
            cpu: cpu
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
