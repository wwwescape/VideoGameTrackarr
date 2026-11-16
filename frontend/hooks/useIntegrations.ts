import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIntegrationsStatus,
  connectGog,
  disconnectGog,
  getGogEntries,
  getGogInstallers,
  getGogInstallerFileLink,
  getGogStatus,
  getSteamEntries,
  getSteamWishlistEntries,
  ignoreGogEntries,
  ignoreGogEntry,
  ignoreSteamEntries,
  ignoreSteamEntry,
  ignoreSteamWishlistEntries,
  ignoreSteamWishlistEntry,
  queueGogInstallerDownload,
  relinkGogEntry,
  relinkSteamEntry,
  relinkSteamWishlistEntry,
  syncGogEntries,
  syncSteamEntries,
  syncSteamWishlistEntries,
  unignoreGogEntry,
  unignoreSteamEntry,
  unignoreSteamWishlistEntry,
  unlinkGogEntry,
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

export function useUnignoreSteamEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unignoreSteamEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-entries"] }),
  });
}

export function useIgnoreSteamEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignoreSteamEntries,
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

export function useUnignoreSteamWishlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unignoreSteamWishlistEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["steam-wishlist-entries"] }),
  });
}

export function useIgnoreSteamWishlistEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignoreSteamWishlistEntries,
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

export function useGogStatus() {
  return useQuery({ queryKey: ["gog-status"], queryFn: getGogStatus });
}

export function useConnectGog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectGog,
    onSuccess: (status) => {
      queryClient.setQueryData(["gog-status"], status);
      queryClient.invalidateQueries({ queryKey: ["integrations-status"] });
    },
  });
}

export function useDisconnectGog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectGog,
    onSuccess: (status) => {
      queryClient.setQueryData(["gog-status"], status);
      queryClient.invalidateQueries({ queryKey: ["integrations-status"] });
    },
  });
}

export function useGogEntries() {
  return useQuery({ queryKey: ["gog-entries"], queryFn: getGogEntries });
}

export function useSyncGogEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncGogEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gog-entries"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useIgnoreGogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignoreGogEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gog-entries"] }),
  });
}

export function useIgnoreGogEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ignoreGogEntries,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gog-entries"] }),
  });
}

export function useUnignoreGogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unignoreGogEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gog-entries"] }),
  });
}

export function useRelinkGogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gogProductId, gameId }: { gogProductId: number; gameId: number }) =>
      relinkGogEntry(gogProductId, gameId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gog-entries"] }),
  });
}

export function useUnlinkGogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkGogEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gog-entries"] }),
  });
}

export function useGogInstallers(gameId: number, enabled = true) {
  return useQuery({
    queryKey: ["gog-installers", gameId],
    queryFn: () => getGogInstallers(gameId),
    enabled,
    // While a file is queued or downloading on the NAS, poll every 3 s so the
    // progress bar moves; once everything settles, stop polling.
    refetchInterval: (query) =>
      query.state.data?.groups.some((group) =>
        group.installers.some((installer) =>
          installer.files.some(
            (file) => file.downloadState === "queued" || file.downloadState === "downloading"
          )
        )
      )
        ? 3000
        : false,
  });
}

export function useQueueGogInstallerDownload(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ installerId, fileId }: { installerId: string; fileId: string }) =>
      queueGogInstallerDownload(gameId, installerId, fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gog-installers", gameId] }),
  });
}

export function useGogInstallerFileLink() {
  return useMutation({
    mutationFn: ({ gameId, fileId }: { gameId: number; fileId: string }) =>
      getGogInstallerFileLink(gameId, fileId),
  });
}
