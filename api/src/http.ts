import type { Cookie } from '@azure/functions'

/**
 * The slice of an Azure Functions HttpRequest the handlers use. Keeping it this
 * small lets tests build requests by hand.
 */
export interface ApiRequest {
  readonly method: string
  readonly url: string
  readonly headers: { get(name: string): string | null }
  readonly params: Record<string, string>
  json(): Promise<unknown>
  arrayBuffer(): Promise<ArrayBuffer>
}

/** Structurally an Azure Functions HttpResponseInit. */
export interface ApiResponse {
  status?: number
  jsonBody?: unknown
  body?: string | Uint8Array
  headers?: Record<string, string>
  cookies?: Cookie[]
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export const json = (jsonBody: unknown, status = 200, extra: Omit<ApiResponse, 'status' | 'jsonBody'> = {}): ApiResponse => ({
  status,
  jsonBody,
  ...extra,
})

export const noContent = (extra: Omit<ApiResponse, 'status'> = {}): ApiResponse => ({ status: 204, ...extra })

export const redirect = (location: string, cookies: Cookie[] = []): ApiResponse => ({
  status: 302,
  headers: { location },
  cookies,
})

const MAX_JSON_BYTES = 256 * 1024

/**
 * Reads a JSON object body. Requiring the JSON content type is also a CSRF guard:
 * a cross-site <form> can't send it, and fetch can't without a CORS preflight.
 */
export async function readJson(req: ApiRequest): Promise<Record<string, unknown>> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Send the request body as JSON')
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_JSON_BYTES) throw new HttpError(413, 'That request is too large')
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new HttpError(400, 'The request body isn’t valid JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object')
  return body as Record<string, unknown>
}

export function readCookie(req: ApiRequest, name: string): string | null {
  for (const part of req.headers.get('cookie')?.split(';') ?? []) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

export function queryParam(req: ApiRequest, name: string): string | null {
  return new URL(req.url).searchParams.get(name)
}

/**
 * Writes from another site are refused, on top of SameSite cookies. Inside Static
 * Web Apps the function sees an internal URL, so the public host the request came
 * in on is taken from the forwarding headers instead.
 */
export function assertSameOrigin(req: ApiRequest, publicOrigin: string | null, dev: boolean) {
  if (req.method === 'GET' || req.method === 'HEAD' || dev) return
  const origin = req.headers.get('origin')
  if (!origin) return
  const allowed = new Set([new URL(req.url).origin])
  if (publicOrigin) allowed.add(publicOrigin)
  for (const host of [req.headers.get('x-forwarded-host'), req.headers.get('host')]) {
    for (const h of host?.split(',') ?? []) if (h.trim()) allowed.add(`https://${h.trim()}`)
  }
  const original = req.headers.get('x-ms-original-url')
  if (original && URL.canParse(original)) allowed.add(new URL(original).origin)
  if (!allowed.has(origin)) throw new HttpError(403, 'Cross-site requests aren’t allowed')
}
