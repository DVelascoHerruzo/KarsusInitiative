// Bundles the API and the shared code it imports from src/lib into api/dist/index.js.
// Everything is inlined except @azure/functions-core, which the Functions host provides.
import { build } from 'esbuild'

await build({
  entryPoints: ['api/src/index.ts'],
  outfile: 'api/dist/index.js',
  tsconfig: 'tsconfig.api.json',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['@azure/functions-core'],
  sourcemap: true,
  logLevel: 'info',
})
