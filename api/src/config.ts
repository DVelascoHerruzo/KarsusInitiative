/**
 * Settings come from the Static Web App's application settings in Azure, or from
 * api/local.settings.json under `func start`. A missing service switches its
 * feature off instead of crashing the whole API.
 */
export interface Config {
  /** Local development: in-memory database, emails printed to the console. Never set in Azure. */
  dev: boolean
  /** The site's public origin, e.g. https://karsusinitiative.com. Used for links in emails and OAuth redirects. */
  publicOrigin: string | null
  sessionSecret: string | null
  cosmos: { connectionString: string; database: string } | null
  storage: { connectionString: string; container: string } | null
  webPubSub: { connectionString: string; hub: string } | null
  mail: { connectionString: string; sender: string } | null
  google: { clientId: string; clientSecret: string } | null
}

const DEV_SECRET = 'karsus-local-development-secret-not-for-production'

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const dev = env.KARSUS_DEV === '1'
  const get = (key: string) => env[key]?.trim() || null
  const cosmos = get('COSMOS_CONNECTION_STRING')
  const storage = get('STORAGE_CONNECTION_STRING')
  const pubsub = get('WEBPUBSUB_CONNECTION_STRING')
  const mail = get('ACS_CONNECTION_STRING')
  const sender = get('MAIL_SENDER')
  const googleId = get('GOOGLE_CLIENT_ID')
  const googleSecret = get('GOOGLE_CLIENT_SECRET')

  return {
    dev,
    publicOrigin: get('PUBLIC_ORIGIN')?.replace(/\/+$/, '') ?? null,
    sessionSecret: get('SESSION_SECRET') ?? (dev ? DEV_SECRET : null),
    cosmos: cosmos ? { connectionString: cosmos, database: get('COSMOS_DATABASE') ?? 'karsus' } : null,
    storage: storage ? { connectionString: storage, container: get('IMAGES_CONTAINER') ?? 'images' } : null,
    webPubSub: pubsub ? { connectionString: pubsub, hub: get('WEBPUBSUB_HUB') ?? 'karsus' } : null,
    mail: mail && sender ? { connectionString: mail, sender } : null,
    google: googleId && googleSecret ? { clientId: googleId, clientSecret: googleSecret } : null,
  }
}
