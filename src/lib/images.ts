import { api } from './api'

export type ImageKind = 'portrait' | 'background'

const MAX_EDGE: Record<ImageKind, number> = { portrait: 640, background: 1920 }
const MAX_INPUT_BYTES = 20 * 1024 * 1024

/**
 * Downscales in the browser and re-encodes as WebP before upload, so a 6 MB phone
 * photo lands as ~150 KB and Blob Storage stays nearly free.
 */
export async function compressImage(file: File, kind: ImageKind): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Images must be under 20 MB')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE[kind] / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser can’t process images')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
  if (!blob) throw new Error('Couldn’t compress that image')
  return blob
}

/** Uploads to Azure Blob Storage through the API, which checks the file and returns its public URL. */
export async function uploadImage(file: File, kind: ImageKind): Promise<string> {
  const blob = await compressImage(file, kind)
  const { url } = await api.post<{ url: string }>(`images?kind=${kind}`, blob)
  return url
}
