// Builds the backdrop in the sizes and formats browsers want, from one source image.
//
//   npm run backdrop
//
// To change the backdrop, replace src/assets/backdrop/source.jpg (any size from
// 1920px wide up), run this, and commit what it writes. Phones get the 640 or
// 1280 version, AVIF where supported (about a fifth of the JPEG's size), then WebP,
// with a JPEG for anything older. Vite gives each file a content hash, so they can
// be cached for a year.
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const dir = fileURLToPath(new URL('../src/assets/backdrop/', import.meta.url))
const source = `${dir}source.jpg`
const WIDTHS = [640, 1280, 1920]

await mkdir(dir, { recursive: true })
for (const width of WIDTHS) {
  // The backdrop always sits under a dark wash, so it can be compressed hard without it showing.
  const resized = sharp(source).resize({ width, withoutEnlargement: true })
  await resized.clone().avif({ quality: 40, effort: 6 }).toFile(`${dir}backdrop-${width}.avif`)
  await resized.clone().webp({ quality: 60 }).toFile(`${dir}backdrop-${width}.webp`)
}
await sharp(source).resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 62, progressive: true, mozjpeg: true }).toFile(`${dir}backdrop-1920.jpg`)
console.log('Backdrop written to', dir)
