import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createManualGame,
  deleteGame,
  getGame,
  importGame,
  linkGameToIgdb,
  linkGameToIgdbViaParent,
  listAddons,
  listGames,
  resyncGame,
  updateManualGame,
} from "../api/games";
import type { ManualGameInput } from "../api/types";

export function useGames(search?: string) {
  return useQuery({
    queryKey: ["games", { search: search ?? "" }],
    queryFn: ({ signal }) => listGames(search, signal),
  });
}

export function useGame(identifier: string | undefined) {
  return useQuery({
    queryKey: ["games", identifier],
    queryFn: () => getGame(identifier!),
    enabled: !!identifier,
  });
}

// Used by Compare, where each entry is a bare uuid (no slug prefix) — resolves via the same
// identifier route, since a bare uuid is still a valid identifier.
export function useGamesByIds(gameIdentifiers: string[]) {
  return useQueries({
    queries: gameIdentifiers.map((identifier) => ({
      queryKey: ["games", identifier],
      queryFn: () => getGame(identifier),
    })),
    combine: (results) => ({
      data: results.map((result) => result.data),
      isLoading: results.some((result) => result.isLoading),
      isError: results.some((result) => result.isError),
    }),
  });
}

export function useAddons(gameId: number) {
  return useQuery({
    queryKey: ["games", gameId, "addons"],
    queryFn: () => listAddons(gameId),
    enabled: Number.isFinite(gameId),
  });
}

export function useDeleteGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useImportGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useCreateManualGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createManualGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useUpdateManualGame(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ManualGameInput>) => updateManualGame(gameId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useResyncGame(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resyncGame(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games", gameId, "addons"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useLinkGameToIgdb(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (igdbId: number) => linkGameToIgdb(gameId, igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games", gameId, "addons"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useLinkGameToIgdbViaParent(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (igdbId: number) => linkGameToIgdbViaParent(gameId, igdbId),
    onSuccess: () => {
      // The original row (gameId) is deleted by the merge, replaced by a new row — no
      // point invalidating its own id-keyed queries, just the broader games list/addons.
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
