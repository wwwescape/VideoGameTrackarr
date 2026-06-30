import { apiClient } from "./client";
import type { RegionResponse } from "./types";

export async function listRegions(): Promise<RegionResponse[]> {
  const response = await apiClient.get<RegionResponse[]>("/api/regions");
  return response.data;
}
