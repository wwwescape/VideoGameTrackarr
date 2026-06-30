import { apiClient } from "./client";
import type { PlatformResponse } from "./types";

export async function listPlatforms(): Promise<PlatformResponse[]> {
  const response = await apiClient.get<PlatformResponse[]>("/api/platforms");
  return response.data;
}
