import { randomUUID } from 'node:crypto'
import { requireUser } from '../auth/session'
import { HttpError, json, queryParam, type ApiRequest } from '../http'
import type { Route } from './route'

const IMAGE_KINDS = new Set(['portrait', 'background'])
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

/** WebP files start "RIFF....WEBP"; anything else is refused whatever its content type claims. */
function isWebp(bytes: Uint8Array) {
  const tag = (from: number) => String.fromCharCode(...bytes.subarray(from, from + 4))
  return bytes.length > 12 && tag(0) === 'RIFF' && tag(8) === 'WEBP'
}

async function readImage(req: ApiRequest): Promise<Uint8Array> {
  if (req.headers.get('content-type') !== 'image/webp') throw new HttpError(415, 'Upload images as WebP')
  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) throw new HttpError(413, 'That image is too large')
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'That image is too large')
  if (!isWebp(bytes)) throw new HttpError(415, 'That file isn’t a WebP image')
  return bytes
}

export const imageRoutes: Route[] = [
  {
    name: 'images',
    route: 'images',
    methods: {
      /** The browser has already resized and re-encoded the image as WebP; this checks and stores it. */
      async POST(req, s) {
        const user = await requireUser(s, req)
        const kind = queryParam(req, 'kind') ?? ''
        if (!IMAGE_KINDS.has(kind)) throw new HttpError(400, 'Kind must be portrait or background')
        if (!s.images) throw new HttpError(503, 'Image uploads aren’t set up on this server')
        const bytes = await readImage(req)
        const url = await s.images.put(`${user.user_id}/${kind}-${randomUUID()}.webp`, bytes, 'image/webp')
        return json({ url }, 201)
      },
    },
  },
]
