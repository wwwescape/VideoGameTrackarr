import { apiClient } from "./client";

export interface ExportJobConfig {
  smbPath: string | null;
  smbUsername: string | null;
  hasPassword: boolean;
  retentionCount: number | null;
  includeFiles: boolean;
}

export async function getExportJobConfig(): Promise<ExportJobConfig> {
  const response = await apiClient.get<ExportJobConfig>("/api/export/job-config");
  return response.data;
}

export async function updateExportJobConfig(config: {
  smbPath: string | null;
  smbUsername: string | null;
  smbPassword: string | null;
  retentionCount: number | null;
  includeFiles: boolean;
}): Promise<ExportJobConfig> {
  const response = await apiClient.put<ExportJobConfig>("/api/export/job-config", config);
  return response.data;
}

export async function testExportJobConnection(config: {
  smbPath: string | null;
  smbUsername: string | null;
  smbPassword: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const response = await apiClient.post<{ ok: boolean; message: string }>(
    "/api/export/job-config/test",
    config
  );
  return response.data;
}
