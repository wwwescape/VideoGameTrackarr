import { MutationCache, QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    // Each mutation refetches what it changes on screen; this also marks everything else stale
    // (without refetching it), so a count or list a mutation doesn't name — Platforms, Series,
    // the storefront list — refetches the next time it's shown instead of waiting out the
    // staleTime below.
    mutationCache: new MutationCache({
      onSuccess: () => queryClient.invalidateQueries({ refetchType: "none" }),
    }),
    defaultOptions: {
      queries: {
        retry: 1,
        // With the rule above, and useJobCompletionRefresh (AppShell) refetching when a
        // background job finishes, lists don't need refetching on every navigation. Opening
        // the app refetches everything anyway (index.tsx).
        staleTime: 5 * 60_000,
      },
    },
  });
  return queryClient;
}
