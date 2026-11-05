import { createHash } from 'node:crypto'
import { HttpError, assertSameOrigin, json, type ApiRequest, type ApiResponse } from './http'
import type { Method, Route } from './routes/route'
import type { Services } from './services'

/** Runs a route's handler with the shared guards, and turns errors into JSON the UI can show. */
export async function dispatch(route: Route, req: ApiRequest, s: Services): Promise<ApiResponse> {
  let res: ApiResponse
  try {
    const handler = route.methods[req.method.toUpperCase() as Method]
    if (!handler) throw new HttpError(405, 'Method not allowed')
    assertSameOrigin(req, s.config.publicOrigin, s.config.dev)
    res = await handler(req, s)
  } catch (e) {
    if (e instanceof HttpError) {
      res = json({ error: e.message }, e.status)
    } else {
      s.log.error(`${req.method} ${route.route} failed`, e)
      res = json({ error: 'Something went wrong on our side. Try again.' }, 500)
    }
  }
  return conditional(route, req, res)
}

/** Account answers (emails, exports) are never kept, not even in the browser's own cache. */
const PRIVATE_ROUTES = /^auth\//

/**
 * API answers are per-user and live, so Cloudflare never caches them. Reads of
 * tables carry an ETag, so the browser can ask "has it changed?" and get an empty
 * 304 back when it hasn't: the player view polls every few seconds, and most
 * polls change nothing.
 */
function conditional(route: Route, req: ApiRequest, res: ApiResponse): ApiResponse {
  const status = res.status ?? 200
  const cacheable = req.method.toUpperCase() === 'GET' && status === 200 && res.jsonBody !== undefined && !PRIVATE_ROUTES.test(route.route)
  if (!cacheable) return { ...res, headers: { 'cache-control': 'no-store', ...res.headers } }

  const etag = `W/"${createHash('sha1').update(JSON.stringify(res.jsonBody)).digest('base64url').slice(0, 20)}"`
  const headers = { 'cache-control': 'private, no-cache', etag, ...res.headers }
  const seen = req.headers.get('if-none-match')?.split(',').map((t) => t.trim())
  if (seen?.includes(etag)) return { status: 304, headers }
  return { ...res, headers }
}
