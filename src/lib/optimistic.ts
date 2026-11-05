import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Mutation callbacks that show a change at once and let the request follow:
 * the cached data is changed immediately, put back (with the error) if the
 * server refuses, and refetched either way so it ends up exact.
 */
export function optimistic<V, T>(qc: QueryClient, key: QueryKey, apply: (data: T, vars: V) => T) {
  return {
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<T>(key)
      if (previous !== undefined) qc.setQueryData<T>(key, apply(previous, vars))
      return { previous }
    },
    onError: (error: Error, _vars: V, ctx: { previous: T | undefined } | undefined) => {
      if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous)
      toast.error(error.message)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  }
}
