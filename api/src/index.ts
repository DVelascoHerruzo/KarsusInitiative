import { app } from '@azure/functions'
import { dispatch } from './dispatch'
import { routes } from './routes'
import { services } from './services'

// Entry point for the Azure Functions host (package.json "main" → dist/index.js).
// Every route is an anonymous HTTP function under /api; the API does its own auth.
for (const route of routes) {
  app.http(route.name, {
    route: route.route,
    methods: Object.keys(route.methods) as ('GET' | 'POST' | 'PATCH' | 'DELETE')[],
    authLevel: 'anonymous',
    handler: (req) => dispatch(route, req, services()),
  })
}
