import { EmailClient } from '@azure/communication-email'
import { BlobServiceClient } from '@azure/storage-blob'
import { WebPubSubServiceClient } from '@azure/web-pubsub'
import { readConfig, type Config } from './config'
import { HttpError } from './http'
import { cosmosStore } from './store/cosmos'
import { memoryStore } from './store/memory'
import type { Store } from './store/types'

/** Live sync: a content-free "changed" ping per encounter, so every screen refetches through its own (protected or redacted) path. */
export interface Live {
  notify(shareToken: string): Promise<void>
  /** A WebSocket URL that receives the encounter's pings, or null when live sync isn't configured. */
  clientUrl(shareToken: string): Promise<string | null>
}

export interface Images {
  /** Stores the bytes and returns their public URL. */
  put(path: string, bytes: Uint8Array, contentType: string): Promise<string>
}

export interface Mail {
  send(message: { to: string; subject: string; text: string; html: string }): Promise<void>
}

export interface Logger {
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export interface Services {
  config: Config
  store: Store
  live: Live
  images: Images | null
  mail: Mail | null
  now(): Date
  log: Logger
}

let current: Services | null = null

export function services(): Services {
  return (current ??= createServices(readConfig()))
}

/** Tests swap in fakes. */
export function setServices(next: Services | null) {
  current = next
}

export function createServices(config: Config, log: Logger = console): Services {
  return {
    config,
    store: config.cosmos
      ? cosmosStore(config.cosmos.connectionString, config.cosmos.database)
      : config.dev
        ? memoryStore()
        : unavailableStore(),
    live: config.webPubSub ? webPubSubLive(config.webPubSub.connectionString, config.webPubSub.hub, log) : noLive,
    images: config.storage ? blobImages(config.storage.connectionString, config.storage.container) : null,
    mail: config.mail ? acsMail(config.mail.connectionString, config.mail.sender) : config.dev ? consoleMail : null,
    now: () => new Date(),
    log,
  }
}

const groupFor = (shareToken: string) => `encounter.${shareToken}`

function webPubSubLive(connectionString: string, hub: string, log: Logger): Live {
  const client = new WebPubSubServiceClient(connectionString, hub)
  return {
    async notify(shareToken) {
      try {
        await client.group(groupFor(shareToken)).sendToAll({ type: 'changed' })
      } catch (e) {
        // A missed ping only delays other screens until their next poll; the write itself succeeded.
        log.warn('Live sync ping failed', e)
      }
    },
    async clientUrl(shareToken) {
      // The token joins the group on connect, so a plain WebSocket is all the browser needs.
      const { url } = await client.getClientAccessToken({ groups: [groupFor(shareToken)], expirationTimeInMinutes: 60 })
      return url
    },
  }
}

const noLive: Live = {
  async notify() {},
  async clientUrl() {
    return null
  },
}

function blobImages(connectionString: string, containerName: string): Images {
  const container = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName)
  return {
    async put(path, bytes, contentType) {
      const blob = container.getBlockBlobClient(path)
      // Every upload gets a new name, so browsers and Cloudflare may cache it forever.
      await blob.uploadData(bytes, { blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: 'public, max-age=31536000, immutable' } })
      return blob.url
    },
  }
}

function acsMail(connectionString: string, sender: string): Mail {
  const client = new EmailClient(connectionString)
  return {
    async send({ to, subject, text, html }) {
      // Queues the message; delivery continues after we respond.
      await client.beginSend({ senderAddress: sender, content: { subject, plainText: text, html }, recipients: { to: [{ address: to }] } })
    },
  }
}

const consoleMail: Mail = {
  async send({ to, subject, text }) {
    console.info(`\n[dev mail] to ${to}: ${subject}\n${text}\n`)
  },
}

function unavailableStore(): Store {
  const fail = async (): Promise<never> => {
    throw new HttpError(503, 'The database isn’t configured on this server')
  }
  return {
    listTables: fail,
    getTable: fail,
    createTable: fail,
    replaceTable: fail,
    deleteTable: fail,
    getEntry: fail,
    createEntry: fail,
    putEntry: fail,
    deleteEntry: fail,
  }
}
