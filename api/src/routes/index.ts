import { accountRoutes } from './account'
import { authRoutes } from './auth'
import { encounterRoutes } from './encounters'
import { folderRoutes } from './folders'
import { imageRoutes } from './images'
import { memberRoutes } from './members'
import { playRoutes } from './play'
import { playerRoutes } from './player'
import { presetRoutes } from './presets'
import type { Route } from './route'

export const routes: Route[] = [...authRoutes, ...accountRoutes, ...encounterRoutes, ...presetRoutes, ...memberRoutes, ...playerRoutes, ...folderRoutes, ...playRoutes, ...imageRoutes]
