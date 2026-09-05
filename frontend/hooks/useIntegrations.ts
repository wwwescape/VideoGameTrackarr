import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIntegrationsStatus,
  getSteamEntries,
  getSteamWishlistEntries,
  ignoreSteamEntry,
  ignoreSteamWishlistEntry,
  relinkSteamEntry,
  relinkSteamWishlistEntry,
  syncSteamEntries,
  syncSteamWishlistEntries,
  unlinkSteamEntry,
  unlinkSteamWishlistEntry,
  updateSteamId,
} from "../api/integrations";

export function useIntegrationsStatus() {
  return useQuery({ queryKey: ["integrations-status"], queryFn: getIntegrationsStatus });
}

export function useUpdateSteamId() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSteamId,
    onSuccess: (status) => queryClient.setQueryData(["integrations-status"], status),
  });
}

export function useSteamEntries() {
  return useQuery({ queryKey: ["steam-entries"], queryFn: getSteamEntries });
}

export function useSyncSteamEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncSteamEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["steam-entries"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useIgnoreSteamEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignoreSteamEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-entries"] }),
  });
}

export function useRelinkSteamEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ steamAppId, gameId }: { steamAppId: number; gameId: number }) =>
      relinkSteamEntry(steamAppId, gameId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-entries"] }),
  });
}

export function useUnlinkSteamEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkSteamEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-entries"] }),
  });
}

export function useSteamWishlistEntries() {
  return useQuery({ queryKey: ["steam-wishlist-entries"], queryFn: getSteamWishlistEntries });
}

export function useSyncSteamWishlistEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncSteamWishlistEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["steam-wishlist-entries"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useIgnoreSteamWishlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignoreSteamWishlistEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-wishlist-entries"] }),
  });
}

export function useRelinkSteamWishlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ steamAppId, gameId }: { steamAppId: number; gameId: number }) =>
      relinkSteamWishlistEntry(steamAppId, gameId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-wishlist-entries"] }),
  });
}

export function useUnlinkSteamWishlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkSteamWishlistEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-wishlist-entries"] }),
  });
}
