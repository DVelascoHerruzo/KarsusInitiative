import type { Folders } from '@/lib/types'
import { requireUser } from '../auth/session'
import * as v from '../domain/validate'
import { json, readJson } from '../http'
import { entryId } from '../store/types'
import type { Route } from './route'

// A person's own folders for their encounter lists. Private to them: filing an
// encounter here never changes who can see it (a campaign does that).

export const folderRoutes: Route[] = [
  {
    name: 'folders',
    route: 'folders',
    methods: {
      async GET(req, s) {
        const user = await requireUser(s, req)
        const entry = await s.store.getEntry(entryId.folders(user.user_id), 'folders')
        return json({ folders: entry?.folders ?? [], filed: entry?.filed ?? {} } satisfies Folders)
      },
      async PUT(req, s) {
        const user = await requireUser(s, req)
        const next = v.folders(await readJson(req))
        await s.store.putEntry({ id: entryId.folders(user.user_id), kind: 'folders', ...next })
        return json(next)
      },
    },
  },
]
