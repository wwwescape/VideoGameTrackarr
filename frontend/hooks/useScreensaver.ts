import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updatePreferences } from "../api/auth";
import { getScreensaverSample, setScreensaverExcluded, setScreensaverExcludedBulk } from "../api/screensaver";
import type { GameDetail } from "../api/types";
import { currentUserQueryKey, useCurrentUser } from "./useAuth";

export const screensaverQueryKey = ["screensaver"] as const;

export const SCREENSAVER_DEFAULT_INTERVAL = 8;
export const SCREENSAVER_MIN_INTERVAL = 5;
export const SCREENSAVER_MAX_INTERVAL = 15;

// How long a sample is reused: long enough that the one prefetched when the button is hovered
// is the one shown when it's clicked, short enough that each new showing gets a new order.
const SAMPLE_FRESH_MS = 60_000;

export const screensaverSampleOptions = {
  queryKey: screensaverQueryKey,
  queryFn: getScreensaverSample,
  staleTime: SAMPLE_FRESH_MS,
  gcTime: SAMPLE_FRESH_MS,
  // Never kept in the offline cache (see offline/queryPersistence.ts).
  meta: { persist: false },
} as const;

// Covers to show. The carousel asks for a new sample itself when it wraps around a library
// larger than one sample (queryClient.fetchQuery with staleTime 0), so focus or a reconnect
// never swaps the order under it.
export function useScreensaverSample() {
  return useQuery({ ...screensaverSampleOptions, refetchOnWindowFocus: false, refetchOnReconnect: false });
}

// Seconds each cover is shown, kept on the account (like the currency) so every screen
// running the screensaver uses the same.
export function useScreensaverInterval() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const seconds = user?.screensaverIntervalSeconds ?? SCREENSAVER_DEFAULT_INTERVAL;
  const save = useMutation({
    mutationFn: (next: number) => updatePreferences({ screensaverIntervalSeconds: next }),
    onSuccess: (updated) => queryClient.setQueryData(currentUserQueryKey, updated),
  });
  return { seconds, save };
}

// A game's screensaver opt-out, from its page. Shown at once on the page (every cached copy of
// this game's details), put back if saving fails; the lists and the screensaver's sample are
// refreshed after.
export function useSetScreensaverExcluded(gameId: number) {
  const queryClient = useQueryClient();
  const isThisGame = (data: unknown): data is GameDetail =>
    typeof data === "object" && data !== null && !Array.isArray(data) && (data as GameDetail).id === gameId &&
    "screensaverExcluded" in data;
  return useMutation({
    mutationFn: (excluded: boolean) => setScreensaverExcluded(gameId, excluded),
    onMutate: async (excluded: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["games"] });
      const previous = queryClient.getQueriesData({ queryKey: ["games"] }).filter(([, data]) => isThisGame(data));
      for (const [key, data] of previous) {
        queryClient.setQueryData(key, { ...(data as GameDetail), screensaverExcluded: excluded });
      }
      return { previous };
    },
    onError: (_error, _excluded, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: screensaverQueryKey });
    },
  });
}

// The Games list's bulk Hide/Show (and its Undo).
export function useSetScreensaverExcludedBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gameIds, excluded }: { gameIds: number[]; excluded: boolean }) =>
      setScreensaverExcludedBulk(gameIds, excluded),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: screensaverQueryKey });
    },
  });
}
