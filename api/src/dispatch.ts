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
  // API answers are per-user and live: never cache them, at Cloudflare or in the browser.
  return { ...res, headers: { 'cache-control': 'no-store', ...res.headers } }
}
