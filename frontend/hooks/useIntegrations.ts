import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectGog,
  deleteGogDownload,
  downloadGogInstaller,
  getGogDownloads,
  getGogInstallers,
  retryGogDownload,
  type GogInstallers,
  disconnectGog,
  getGogEntries,
  getGogStatus,
  getGogWishlistEntries,
  ignoreGogWishlistEntries,
  ignoreGogWishlistEntry,
  relinkGogWishlistEntry,
  syncGogWishlistEntries,
  unignoreGogWishlistEntry,
  unlinkGogWishlistEntry,
  getIntegrationsStatus,
  ignoreGogEntries,
  ignoreGogEntry,
  relinkGogEntry,
  syncGogEntries,
  unignoreGogEntry,
  unlinkGogEntry,
  getSteamEntries,
  getSteamWishlistEntries,
  ignoreSteamEntries,
  ignoreSteamEntry,
  ignoreSteamWishlistEntries,
  ignoreSteamWishlistEntry,
  relinkSteamEntry,
  relinkSteamWishlistEntry,
  syncSteamEntries,
  syncSteamWishlistEntries,
  unignoreSteamEntry,
  unignoreSteamWishlistEntry,
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

// --- GOG Sync -------------------------------------------------------------------------------

const GOG_STATUS_KEY = ["gog-status"];
const GOG_ENTRIES_KEY = ["gog-entries"];

export function useGogStatus() {
  return useQuery({ queryKey: GOG_STATUS_KEY, queryFn: getGogStatus });
}

// Connecting or disconnecting changes both the GOG status and the Integrations summary.
function useGogAccountMutation<TArgs>(mutationFn: (args: TArgs) => ReturnType<typeof getGogStatus>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (status) => {
      queryClient.setQueryData(GOG_STATUS_KEY, status);
      queryClient.invalidateQueries({ queryKey: ["integrations-status"] });
    },
  });
}

export function useConnectGog() {
  return useGogAccountMutation((redirectUrl: string) => connectGog(redirectUrl));
}

export function useDisconnectGog() {
  return useGogAccountMutation<void>(() => disconnectGog());
}

export function useGogEntries() {
  return useQuery({ queryKey: GOG_ENTRIES_KEY, queryFn: getGogEntries });
}

export function useSyncGogEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncGogEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOG_ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

function useGogEntriesMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOG_ENTRIES_KEY }),
  });
}

export function useIgnoreGogEntry() {
  return useGogEntriesMutation(ignoreGogEntry);
}

export function useUnignoreGogEntry() {
  return useGogEntriesMutation(unignoreGogEntry);
}

export function useIgnoreGogEntries() {
  return useGogEntriesMutation(ignoreGogEntries);
}

export function useRelinkGogEntry() {
  return useGogEntriesMutation(({ gogProductId, gameId }: { gogProductId: number; gameId: number }) =>
    relinkGogEntry(gogProductId, gameId)
  );
}

export function useUnlinkGogEntry() {
  return useGogEntriesMutation(unlinkGogEntry);
}

const GOG_WISHLIST_ENTRIES_KEY = ["gog-wishlist-entries"];

export function useGogWishlistEntries() {
  return useQuery({ queryKey: GOG_WISHLIST_ENTRIES_KEY, queryFn: getGogWishlistEntries });
}

export function useSyncGogWishlistEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncGogWishlistEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOG_WISHLIST_ENTRIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

function useGogWishlistMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOG_WISHLIST_ENTRIES_KEY }),
  });
}

export function useIgnoreGogWishlistEntry() {
  return useGogWishlistMutation(ignoreGogWishlistEntry);
}

export function useUnignoreGogWishlistEntry() {
  return useGogWishlistMutation(unignoreGogWishlistEntry);
}

export function useIgnoreGogWishlistEntries() {
  return useGogWishlistMutation(ignoreGogWishlistEntries);
}

export function useRelinkGogWishlistEntry() {
  return useGogWishlistMutation(({ gogProductId, gameId }: { gogProductId: number; gameId: number }) =>
    relinkGogWishlistEntry(gogProductId, gameId)
  );
}

export function useUnlinkGogWishlistEntry() {
  return useGogWishlistMutation(unlinkGogWishlistEntry);
}

// --- GOG offline installers ---------------------------------------------------------------------

const GOG_DOWNLOADS_KEY = ["gog-downloads"];
const gogInstallersKey = (gameId: number) => ["gog-installers", gameId];
const ACTIVE_POLL_MS = 2000;

const isActive = (state: string) => state === "queued" || state === "downloading";

// Polls every 2 s while something is queued or downloading. The server caches GOG's listing,
// so polling only reads this server's own download state.
export function useGogInstallers(gameId: number, enabled: boolean) {
  return useQuery({
    queryKey: gogInstallersKey(gameId),
    queryFn: () => getGogInstallers(gameId),
    enabled,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.groups.some((group) =>
        group.installers.some((installer) => installer.files.some((part) => isActive(part.state)))
      )
        ? ACTIVE_POLL_MS
        : false,
  });
}

export function useDownloadGogInstaller(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, installerId }: { productId: number; installerId: string }) =>
      downloadGogInstaller(gameId, productId, installerId),
    onSuccess: (installers: GogInstallers) => {
      queryClient.setQueryData(gogInstallersKey(gameId), installers);
      queryClient.invalidateQueries({ queryKey: GOG_DOWNLOADS_KEY });
    },
  });
}

export function useGogDownloads() {
  return useQuery({
    queryKey: GOG_DOWNLOADS_KEY,
    queryFn: getGogDownloads,
    refetchInterval: (query) =>
      query.state.data?.downloads.some((download) => isActive(download.status)) ? ACTIVE_POLL_MS : false,
  });
}

function useGogDownloadMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOG_DOWNLOADS_KEY });
      queryClient.invalidateQueries({ queryKey: ["gog-installers"] });
    },
  });
}

export function useRetryGogDownload() {
  return useGogDownloadMutation(retryGogDownload);
}

export function useDeleteGogDownload() {
  return useGogDownloadMutation(deleteGogDownload);
}
