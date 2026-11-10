/**
 * The Azure Functions API lives on the same origin under /api, and the session is
 * an HttpOnly cookie, so there are no keys or tokens in the browser.
 * Builds with VITE_ACCOUNTS=off have no API: landing page and offline demo only.
 */
export const isBackendConfigured = import.meta.env.VITE_ACCOUNTS !== 'off'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Something that isn't there (or isn't yours): a second try won't change that. */
export class NotFoundError extends Error {
  constructor() {
    super('Not found')
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  let payload: BodyInit | undefined
  if (body instanceof Blob) {
    payload = body
    headers['content-type'] = body.type
  } else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  }

  let res: Response
  try {
    res = await fetch(`/api/${path}`, { method, headers, body: payload, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'Can’t reach Karsus. Check your connection and try again.')
  }
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T = undefined>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = undefined>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T = undefined>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string) => request<undefined>('DELETE', path),
  /** Any method, with a body: a DELETE that needs a confirmation, say. */
  request: <T = undefined>(method: string, path: string, body?: unknown) => request<T>(method, path, body),
}
