import { apiClient } from "./client";

export async function getShareLink(): Promise<string> {
  const response = await apiClient.get<{ token: string }>("/api/share-link");
  return response.data.token;
}

export async function regenerateShareLink(): Promise<string> {
  const response = await apiClient.post<{ token: string }>("/api/share-link/regenerate");
  return response.data.token;
}
