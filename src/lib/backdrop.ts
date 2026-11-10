import avif640 from '@/assets/backdrop/backdrop-640.avif'
import avif1280 from '@/assets/backdrop/backdrop-1280.avif'
import avif1920 from '@/assets/backdrop/backdrop-1920.avif'
import jpg1920 from '@/assets/backdrop/backdrop-1920.jpg'
import webp640 from '@/assets/backdrop/backdrop-640.webp'
import webp1280 from '@/assets/backdrop/backdrop-1280.webp'
import webp1920 from '@/assets/backdrop/backdrop-1920.webp'

// The backdrop in every size and format (built by `npm run backdrop`). Browsers
// take the smallest one that fills their screen, AVIF first.
export const BACKDROP = {
  avif: `${avif640} 640w, ${avif1280} 1280w, ${avif1920} 1920w`,
  webp: `${webp640} 640w, ${webp1280} 1280w, ${webp1920} 1920w`,
  fallback: jpg1920,
}
