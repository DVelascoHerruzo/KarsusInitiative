/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "off" builds the site without accounts: landing page and offline demo only. */
  readonly VITE_ACCOUNTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
