import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIntegrationsStatus,
  getSteamEntries,
  getSteamWishlistEntries,
  ignoreSteamEntry,
  ignoreSteamWishlistEntry,
  syncSteamEntries,
  syncSteamWishlistEntries,
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
