import { apiClient } from "./client";
import type { VersionInfo } from "./types";

export async function getVersion(): Promise<VersionInfo> {
  const response = await apiClient.get<VersionInfo>("/api/version");
  return response.data;
}
