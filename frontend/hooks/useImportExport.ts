import { useMutation, useQueryClient } from "@tanstack/react-query";
import { exportBackupBlob, exportCsvBlob, exportHardwareCsvBlob, restoreBackup } from "../api/importExport";
import { downloadBlob } from "../utils/download";

export function useExportCsv() {
  return useMutation({
    mutationFn: async () => {
      const blob = await exportCsvBlob();
      downloadBlob(blob, "videogametrackarr-library.csv");
    },
  });
}

export function useExportBackup() {
  return useMutation({
    mutationFn: async () => {
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
      // A restore replaces the entire dataset at once - everything cached is stale.
      queryClient.invalidateQueries();
    },
  });
}

export function useExportHardwareCsv() {
  return useMutation({
    mutationFn: async () => {
      const blob = await exportHardwareCsvBlob();
      downloadBlob(blob, "videogametrackarr-hardware.csv");
    },
  });
}
