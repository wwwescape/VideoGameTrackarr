import { apiClient } from "./client";
import type { VersionInfo } from "./types";

export async function getVersion(force = false): Promise<VersionInfo> {
  const response = await apiClient.get<VersionInfo>("/api/version", {
    params: force ? { force: true } : undefined,
  });
  return response.data;
}
