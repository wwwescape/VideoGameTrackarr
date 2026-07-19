import { apiClient } from "./client";
import type { RestoreStatus } from "./types";

export async function exportCsvBlob(): Promise<Blob> {
  const response = await apiClient.get("/api/export/csv", { responseType: "blob" });
  return response.data;
}

export async function exportBackupBlob(): Promise<Blob> {
  const response = await apiClient.get("/api/export/backup", { responseType: "blob" });
  return response.data;
}

// Kicks off the restore as a server-side background job and resolves as soon as it starts
// (202) — not once it finishes. Progress is tracked via fetchRestoreStatus/RestoreGuard.
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

export async function exportHardwareCsvBlob(): Promise<Blob> {
  const response = await apiClient.get("/api/export/hardware-csv", { responseType: "blob" });
  return response.data;
}
