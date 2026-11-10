// Who runs the site, for the privacy policy, the terms and every email we send.
// The GDPR requires a way to reach whoever controls people's data.

export const SITE_NAME = 'Karsus Initiative'
/** Support inbox: shown on the legal pages, and replies to any Karsus email land here. */
export const CONTACT_EMAIL: string | null = 'karsus.support@gmail.com'
export const KOFI_URL = 'https://ko-fi.com/barope'
/** When the privacy policy and terms last changed. */
export const LEGAL_UPDATED = '2026-11-10'

/**
 * Credit for the backdrop (src/assets/backdrop/source.jpg), shown in every footer. Set it
 * to null for an image that needs no credit.
 */
export const BACKDROP_CREDIT: { text: string; href: string } | null = {
  text: 'Thomas Cole, The Consummation of Empire (1836), public domain',
  href: 'https://commons.wikimedia.org/wiki/File:Cole_Thomas_The_Consummation_The_Course_of_the_Empire_1836.jpg',
}
