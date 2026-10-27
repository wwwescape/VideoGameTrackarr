import { apiClient } from "./client";
import type { RestoreStatus } from "./types";

export async function exportBackupBlob(): Promise<Blob> {
  const response = await apiClient.get("/api/export/backup", { responseType: "blob" });
  return response.data;
}

// Which files a .zip backup carries besides the data.
export interface BackupFileOptions {
  roms: boolean;
  bios: boolean;
  images: boolean;
}

// A backup with files can be many GB, so it isn't fetched into a Blob: the server hands out
// a short-lived signed link and the browser downloads it itself.
export async function createFullBackupLink(options: BackupFileOptions): Promise<string> {
  const response = await apiClient.post<{ url: string }>("/api/export/backup/full-link", options);
  return response.data.url;
}

// Kicks off the restore as a server-side background job and resolves as soon as it starts
// (202) — not once it finishes. Progress is tracked via fetchRestoreStatus/RestoreGuard.
// Accepts the JSON backup or a full-backup .zip.
export async function restoreBackup(file: File): Promise<RestoreStatus> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<RestoreStatus>("/api/import/backup", formData);
  return response.data;
}

// Uses apiClient (not bare axios) deliberately: a restore can outlive an access token, and
// apiClient's response interceptor (see api/client.ts) silently refreshes on 401, so a
// polling loop built on this keeps working across that expiry for free.
export async function fetchRestoreStatus(): Promise<RestoreStatus> {
  const response = await apiClient.get<RestoreStatus>("/api/import/backup/status");
  return response.data;
}

export async function acknowledgeRestoreStatus(): Promise<void> {
  await apiClient.post("/api/import/backup/status/acknowledge");
}
