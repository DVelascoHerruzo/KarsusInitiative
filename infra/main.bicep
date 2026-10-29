// Karsus Initiative on Azure. Everything sits on a free tier or costs cents a month:
//   Static Web App (Free)         site + managed Functions API at /api
//   Cosmos DB (free tier)         1000 RU/s and 25 GB free; the account is capped at 1000 RU/s so it can't bill
//   Storage account               uploaded portraits and backdrops (public-read blobs)
//   Web PubSub (Free_F1)          live sync to player screens (20 concurrent connections)
//   Communication Services        password reset email from an Azure-managed sender domain
//
// Deploy (one line; see README for generating the secret):
//   az deployment group create -g <resource-group> -f infra/main.bicep -p sessionSecret=<64 random hex chars>
// Cloudflare sits in front for DNS, TLS and caching; see README.

targetScope = 'resourceGroup'

@description('Prefix for resource names.')
param name string = 'karsus'

// Region defaults are where the live deployment sits. West Europe refused new resources for this
// subscription, and North Europe had no Cosmos DB capacity, hence the spread. A resource can't move
// region, so keep these unless you deploy into a fresh resource group.

@description('Region for Storage and Web PubSub.')
param location string = 'northeurope'

@description('Region for Cosmos DB: Cosmos regions run out of capacity independently of the others.')
param cosmosLocation string = 'swedencentral'

@description('Static Web Apps only runs in a few regions.')
@allowed(['westeurope', 'eastus2', 'centralus', 'westus2', 'eastasia'])
param staticWebAppLocation string = 'eastus2'

@description('The public site address, used for links in emails and the Google sign-in redirect.')
param publicOrigin string = 'https://karsusinitiative.com'

@description('Signs session cookies. Any random string of at least 32 characters; changing it signs everyone out.')
@secure()
@minLength(32)
param sessionSecret string

@description('Google OAuth client for "Continue with Google". Leave both empty and the button doesn\'t appear.')
param googleClientId string = ''

@secure()
param googleClientSecret string = ''

@description('Cosmos DB gives one free-tier account per subscription. Set false if another account already uses it.')
param cosmosFreeTier bool = true

@description('Where Communication Services stores email data.')
param emailDataLocation string = 'Europe'

var suffix = uniqueString(resourceGroup().id)

// ─── Cosmos DB ───────────────────────────────────────────────────────────────

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: '${name}-cosmos-${suffix}'
  location: cosmosLocation
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: cosmosFreeTier
    // Never provision past what the free tier covers.
    capacity: { totalThroughputLimit: 1000 }
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: cosmosLocation, failoverPriority: 0, isZoneRedundant: false }]
    minimalTlsVersion: 'Tls12'
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmos
  name: 'karsus'
  properties: {
    resource: { id: 'karsus' }
    // Shared by both containers: exactly the free tier's 1000 RU/s.
    options: { throughput: 1000 }
  }
}

// Encounters and presets, one document each with creatures embedded, partitioned by owner.
resource tablesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: 'tables'
  properties: {
    resource: {
      id: 'tables'
      partitionKey: { paths: ['/owner_id'], kind: 'Hash' }
    }
  }
}

// Users, email and Google aliases, share links and reset tokens. TTL is on so reset tokens expire on their own.
resource directoryContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: 'directory'
  properties: {
    resource: {
      id: 'directory'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
      defaultTtl: -1
    }
  }
}

// ─── Images ──────────────────────────────────────────────────────────────────

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower(take('${name}img${suffix}', 24))
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource imagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'images'
  // Anyone can read a blob by its (unguessable) URL; only the API can write.
  properties: { publicAccess: 'Blob' }
}

// ─── Live sync ───────────────────────────────────────────────────────────────

resource pubsub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: '${name}-pubsub-${suffix}'
  location: location
  sku: { name: 'Free_F1', tier: 'Free', capacity: 1 }
  properties: {}
}

// ─── Email ───────────────────────────────────────────────────────────────────

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${name}-email-${suffix}'
  location: 'global'
  properties: { dataLocation: emailDataLocation }
}

// An Azure-managed sender domain (DoNotReply@<id>.azurecomm.net) works without DNS changes.
resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${name}-acs-${suffix}'
  location: 'global'
  properties: {
    dataLocation: emailDataLocation
    linkedDomains: [emailDomain.id]
  }
}

// ─── Site and API ────────────────────────────────────────────────────────────

// Deployed from GitHub Actions with the deployment token, not linked to the repository.
resource site 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${name}-site-${suffix}'
  location: staticWebAppLocation
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

// Application settings reach the managed Functions as environment variables (see api/src/config.ts).
resource siteSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: site
  name: 'appsettings'
  properties: {
    PUBLIC_ORIGIN: publicOrigin
    SESSION_SECRET: sessionSecret
    COSMOS_CONNECTION_STRING: cosmos.listConnectionStrings().connectionStrings[0].connectionString
    COSMOS_DATABASE: database.name
    STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    IMAGES_CONTAINER: imagesContainer.name
    WEBPUBSUB_CONNECTION_STRING: pubsub.listKeys().primaryConnectionString
    ACS_CONNECTION_STRING: communication.listKeys().primaryConnectionString
    MAIL_SENDER: 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'
    GOOGLE_CLIENT_ID: googleClientId
    GOOGLE_CLIENT_SECRET: googleClientSecret
  }
}

output staticWebAppName string = site.name
@description('Point Cloudflare DNS here (CNAME).')
output staticWebAppHostname string = site.properties.defaultHostname
output imagesHost string = '${storage.name}.blob.${environment().suffixes.storage}'
