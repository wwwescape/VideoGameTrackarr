import { apiClient } from "./client";
import type { BackupRestoreResult } from "./types";

export async function exportCsvBlob(): Promise<Blob> {
  const response = await apiClient.get("/api/export/csv", { responseType: "blob" });
  return response.data;
}

export async function exportBackupBlob(): Promise<Blob> {
  const response = await apiClient.get("/api/export/backup", { responseType: "blob" });
  return response.data;
}

export async function restoreBackup(file: File): Promise<BackupRestoreResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<BackupRestoreResult>("/api/import/backup", formData);
  return response.data;
}

export async function exportHardwareCsvBlob(): Promise<Blob> {
  const response = await apiClient.get("/api/export/hardware-csv", { responseType: "blob" });
  return response.data;
}
