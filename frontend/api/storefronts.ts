import { apiClient } from "./client";

export async function listStorefronts(): Promise<string[]> {
  const response = await apiClient.get<string[]>("/api/storefronts");
  return response.data;
}
