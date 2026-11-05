import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Folder, Folders, Mode } from '@/lib/types'

const key = ['folders'] as const
const EMPTY: Folders = { folders: [], filed: {} }

/**
 * Someone's own encounter folders. The whole list is saved in one request, and
 * every change shows straight away (the server copy follows).
 */
export function useFolders(side: Mode) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: key, queryFn: () => api.get<Folders>('folders') })
  const save = useMutation({
    // One save at a time, in order, so a quick "new folder, then file into it" lands as made.
    scope: { id: 'folders' },
    mutationFn: ({ next }: { next: Folders; previous: Folders }) => api.put<Folders>('folders', next),
    onError: (e: Error, { previous }) => {
      qc.setQueryData(key, previous)
      toast.error(e.message)
    },
  })

  const all = query.data ?? EMPTY
  /** Applies a change on screen at once (synchronously, so changes can follow each other), then saves it. */
  const write = (change: (f: Folders) => Folders) => {
    const previous = qc.getQueryData<Folders>(key) ?? all
    const next = change(previous)
    void qc.cancelQueries({ queryKey: key })
    qc.setQueryData(key, next)
    save.mutate({ next, previous })
    return previous
  }

  return {
    /** This side's folders, in the order they were made. */
    folders: all.folders.filter((f) => f.side === side),
    filed: all.filed,
    create(name: string): Folder {
      const folder: Folder = { id: crypto.randomUUID(), name: name.trim().slice(0, 60), side }
      write((f) => ({ ...f, folders: [...f.folders, folder] }))
      return folder
    },
    rename: (id: string, name: string) => write((f) => ({ ...f, folders: f.folders.map((x) => (x.id === id ? { ...x, name: name.trim().slice(0, 60) } : x)) })),
    /** Puts everything back as it was before a change (for Undo). */
    restore: (snapshot: Folders) => write(() => snapshot),
    /** Deleting a folder keeps its encounters; they go back to their usual place. Returns the state before, for Undo. */
    remove: (id: string) =>
      write((f) => ({
        folders: f.folders.filter((x) => x.id !== id),
        filed: Object.fromEntries(Object.entries(f.filed).filter(([, folderId]) => folderId !== id)),
      })),
    /** Files an encounter in a folder, or takes it out with null. */
    file: (encounterId: string, folderId: string | null) =>
      write((f) => {
        const filed = Object.fromEntries(Object.entries(f.filed).filter(([id]) => id !== encounterId))
        return { ...f, filed: folderId ? { ...filed, [encounterId]: folderId } : filed }
      }),
  }
}

export type FolderControls = ReturnType<typeof useFolders>
