import { useEffect, useRef, useState } from 'react'
import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, NotFoundError, api } from '@/lib/api'
import { advanceTurn } from '@/lib/combat'
import { parseConditions } from '@/lib/conditions'
import { optimistic } from '@/lib/optimistic'
import type { Creature, CreaturePatch, Encounter, EncounterPatch, EncounterSummary, NewCreature, NewEncounter, SharedEncounter } from '@/lib/types'

export const keys = {
  encounters: ['encounters'] as const,
  encounter: (id: string) => ['encounter', id] as const,
  shared: (token: string) => ['shared', token] as const,
}

// Lives in lib/api so the app shell can check for it without loading this module.
export { NotFoundError }

/** A 404 from the API becomes NotFoundError, so pages can tell "gone" from "broken". */
export async function orNotFound<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new NotFoundError()
    throw e
  }
}

export const withConditions = <T extends { conditions: unknown }>(c: T) => ({ ...c, conditions: parseConditions(c.conditions) })

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useEncounterList() {
  // Refreshes so a co-DM's encounter going live appears on its own.
  return useQuery({ queryKey: keys.encounters, queryFn: () => api.get<EncounterSummary[]>('encounters'), refetchInterval: 15_000 })
}

/** Shared by the page and by hovering its card, which starts loading it early. */
export const encounterQuery = (id: string) =>
  queryOptions({
    queryKey: keys.encounter(id),
    queryFn: async (): Promise<Encounter> => {
      const encounter = await orNotFound(api.get<Encounter>(`encounters/${id}`))
      return { ...encounter, creatures: encounter.creatures.map(withConditions) }
    },
  })

export function useEncounter(id: string) {
  return useQuery(encounterQuery(id))
}

export function useSharedEncounter(token: string, liveConnected = false) {
  return useQuery({
    queryKey: keys.shared(token),
    queryFn: async (): Promise<SharedEncounter | null> => {
      try {
        const data = await api.get<SharedEncounter>(`play/${token}`)
        return { ...data, creatures: data.creatures.map(withConditions) }
      } catch (e) {
        // A closed or unknown table is an answer, not an error.
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    // Live pings bring changes at once; without them, poll every couple of seconds (unchanged polls are an empty 304).
    refetchInterval: pollEvery(liveConnected),
  })
}

// ─── Live sync ───────────────────────────────────────────────────────────────

/**
 * Listens for the encounter's "changed" pings over Azure Web PubSub. The API hands
 * out a WebSocket URL that has already joined the encounter's group; the ping
 * carries no data, so each screen refetches through its own protected or redacted
 * path. `onChange` is debounced so a burst of writes causes one refetch. When live
 * sync isn't configured (the API answers 204), screens fall back to polling.
 * `source` is the API path that hands out the URL: `live/<share token>` for the
 * shared link, `encounters/<id>/live` for signed-in players.
 */
export function useLivePings(source: string | undefined, onChange: () => void): boolean {
  const latest = useRef(onChange)
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    latest.current = onChange
  })

  useEffect(() => {
    if (!source) return
    let socket: WebSocket | null = null
    let closed = false
    let debounce: ReturnType<typeof setTimeout> | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempt = 0

    const fire = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => latest.current(), 50)
    }
    const reconnect = () => {
      if (closed) return
      // 1s, 2s, 4s … capped at 30s, so a dropped connection doesn't hammer the API.
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt++))
    }

    async function connect() {
      let url: string | undefined
      try {
        const res = await fetch(`/api/${source}`, { credentials: 'same-origin' })
        if (res.status === 204 || res.status === 404) return
        if (!res.ok) return reconnect()
        url = ((await res.json()) as { url: string }).url
      } catch {
        return reconnect()
      }
      if (closed) return
      socket = new WebSocket(url)
      socket.onopen = () => {
        attempt = 0
        setConnected(true)
        // Catch up on anything missed while disconnected.
        fire()
      }
      socket.onmessage = fire
      socket.onclose = () => {
        setConnected(false)
        reconnect()
      }
    }

    void connect()
    return () => {
      closed = true
      clearTimeout(debounce)
      clearTimeout(retry)
      socket?.close()
    }
  }, [source])
  return connected
}

export const useEncounterPings = (token: string | undefined, onChange: () => void) => useLivePings(token && `live/${token}`, onChange)

/** How often a live screen checks for changes: every couple of seconds, unless live pings already deliver them. */
export const pollEvery = (liveConnected: boolean) => (liveConnected ? 20_000 : 2_000)

// ─── Writes ──────────────────────────────────────────────────────────────────

function patchCache(qc: QueryClient, id: string, fn: (e: Encounter) => Encounter) {
  qc.setQueryData<Encounter>(keys.encounter(id), (old) => (old ? fn(old) : old))
}

/**
 * Optimistic mutations for the DM screen. Every write updates the cache first,
 * rolls back on failure and re-syncs from the server when it settles.
 */
export function useEncounterMutations(id: string) {
  const qc = useQueryClient()
  const mutationKey = keys.encounter(id)
  const base = `encounters/${id}`

  function optimistic<V>(apply: (e: Encounter, vars: V) => Encounter) {
    return {
      mutationKey,
      onMutate: async (vars: V) => {
        await qc.cancelQueries({ queryKey: mutationKey })
        const previous = qc.getQueryData<Encounter>(mutationKey)
        patchCache(qc, id, (e) => apply(e, vars))
        return { previous }
      },
      onError: (error: Error, _vars: V, ctx: { previous?: Encounter } | undefined) => {
        if (ctx?.previous) qc.setQueryData(mutationKey, ctx.previous)
        toast.error(error.message)
      },
      onSettled: () => {
        // Only resync once the last in-flight write lands, so rapid clicks don't flicker.
        if (qc.isMutating({ mutationKey }) === 1) void qc.invalidateQueries({ queryKey: mutationKey })
      },
    }
  }

  const advance = useMutation({
    // The API runs the same advanceTurn, so this prediction matches what comes back.
    ...optimistic<1 | -1>((e, step) => {
      const next = advanceTurn({ round: e.round, activeId: e.active_creature_id, creatures: e.creatures }, step)
      return { ...e, round: next.round, active_creature_id: next.activeId, creatures: next.creatures }
    }),
    mutationFn: (step: 1 | -1) => api.post(`${base}/turn`, { step }),
  })

  const updateEncounter = useMutation({
    ...optimistic<EncounterPatch>((e, patch) => ({ ...e, ...patch })),
    mutationFn: (patch: EncounterPatch) => api.patch(base, patch),
  })

  const updateCreature = useMutation({
    ...optimistic<{ cid: string; patch: CreaturePatch }>((e, { cid, patch }) => ({
      ...e,
      creatures: e.creatures.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
    })),
    mutationFn: ({ cid, patch }: { cid: string; patch: CreaturePatch }) => api.patch(`${base}/creatures/${cid}`, patch),
  })

  const removeCreature = useMutation({
    ...optimistic<string>((e, cid) => ({ ...e, creatures: e.creatures.filter((c) => c.id !== cid) })),
    mutationFn: (cid: string) => api.delete(`${base}/creatures/${cid}`),
  })

  const addCreatures = useMutation({
    mutationKey,
    mutationFn: (creatures: NewCreature[]) => api.post<Creature[]>(`${base}/creatures`, { creatures }),
    onSuccess: (added) => patchCache(qc, id, (e) => ({ ...e, creatures: [...e.creatures, ...added.map(withConditions)] })),
    onError: (error: Error) => toast.error(error.message),
  })

  return { advance, updateEncounter, updateCreature, removeCreature, addCreatures }
}

export function useCreateEncounter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewEncounter) => api.post<{ id: string }>('encounters', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.encounters }),
    onError: (error: Error) => toast.error(error.message),
  })
}

/** Gone from the list at once; the delete request follows, and a failure puts it back. */
export function useDeleteEncounter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`encounters/${id}`),
    ...optimistic<string, EncounterSummary[]>(qc, keys.encounters, (list, id) => list.filter((e) => e.id !== id)),
  })
}

// ─── Presence ────────────────────────────────────────────────────────────────

/**
 * While the DM has an encounter open (and the tab visible), it's live: it moves to
 * the top of everyone's encounter list. A heartbeat every 20s; leaving clears it.
 */
export function useDmPresence(id: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const beat = () => {
      if (document.visibilityState === 'visible') api.post(`encounters/${id}/presence`).catch(() => {})
    }
    const leave = () => {
      // keepalive lets the request finish even while the page is unloading.
      void fetch(`/api/encounters/${id}/presence`, { method: 'DELETE', credentials: 'same-origin', keepalive: true }).catch(() => {})
    }
    beat()
    const timer = setInterval(beat, 20_000)
    document.addEventListener('visibilitychange', beat)
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', beat)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [id, enabled])
}
