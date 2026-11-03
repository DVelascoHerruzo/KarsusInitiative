import { authRoutes } from './auth'
import { encounterRoutes } from './encounters'
import { imageRoutes } from './images'
import { memberRoutes } from './members'
import { playRoutes } from './play'
import { playerRoutes } from './player'
import { presetRoutes } from './presets'
import type { Route } from './route'

export const routes: Route[] = [...authRoutes, ...encounterRoutes, ...presetRoutes, ...memberRoutes, ...playerRoutes, ...playRoutes, ...imageRoutes]
