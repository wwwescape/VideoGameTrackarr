import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeRestoreStatus,
  createFullBackupLink,
  exportBackupBlob,
  fetchRestoreStatus,
  restoreBackup,
  type BackupFileOptions,
} from "../api/importExport";
import { resolveAssetUrl } from "../api/client";
import { downloadBlob, downloadFromUrl } from "../utils/download";

export const restoreStatusQueryKey = ["restore", "status"] as const;

// The backup: a .json with the data, or a .zip when any files are picked to go with it.
export function useExportBackup() {
  return useMutation({
    mutationFn: async (files: BackupFileOptions = { roms: false, bios: false, images: false }) => {
      if (files.roms || files.bios || files.images) {
        const url = await createFullBackupLink(files);
        downloadFromUrl(resolveAssetUrl(url) ?? url);
        return;
      }
      const blob = await exportBackupBlob();
      downloadBlob(blob, "videogametrackarr-backup.json");
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreBackup,
    // File variables can't survive the offline persister's JSON serialization, and this is
    // a destructive, wipe-and-replace effect that should never be silently queued for
    // whenever the network happens to return — 'always' runs (or fails) immediately instead.
    networkMode: "always",
    onSuccess: () => {
      // The restore has only just started (202) — its eventual result isn't known yet, so
      // just make sure the status poller below picks up "running" right away instead of
      // waiting for its next interval tick.
      queryClient.invalidateQueries({ queryKey: restoreStatusQueryKey });
    },
  });
}

// Polled from RestoreGuard (mounted once in AppShell) for as long as the authenticated app
// is open, so an in-progress restore is detected on first load too — not just right after
// this tab's own restoreBackup call — which is what makes the blocking overlay survive a
// refresh, a route change, or the tab being closed and reopened mid-restore.
export function useRestoreStatus() {
  return useQuery({
    queryKey: restoreStatusQueryKey,
    queryFn: fetchRestoreStatus,
    refetchInterval: 3000,
    // The app's offline persister (offline/queryPersistence.ts) rehydrates queries from
    // IndexedDB on load, and the global default staleTime is 30s — without overriding it
    // here, a page refresh could briefly show a stale cached "idle" (persisted from before
    // this session) instead of immediately refetching real status, letting the blocking
    // overlay flash absent right when it matters most.
    staleTime: 0,
    refetchIntervalInBackground: true,
  });
}

export function useAcknowledgeRestoreStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeRestoreStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restoreStatusQueryKey });
    },
  });
}
