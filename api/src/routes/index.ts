import { authRoutes } from './auth'
import { encounterRoutes } from './encounters'
import { imageRoutes } from './images'
import { playRoutes } from './play'
import { presetRoutes } from './presets'
import type { Route } from './route'

export const routes: Route[] = [...authRoutes, ...encounterRoutes, ...presetRoutes, ...playRoutes, ...imageRoutes]
