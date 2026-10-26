import { apiClient } from "./client";

// null while sharing is off; reading it never turns sharing on.
export async function getShareLink(): Promise<string | null> {
  const response = await apiClient.get<{ token: string | null }>("/api/share-link");
  return response.data.token;
}

export async function enableShareLink(): Promise<string> {
  const response = await apiClient.post<{ token: string }>("/api/share-link");
  return response.data.token;
}

export async function disableShareLink(): Promise<void> {
  await apiClient.delete("/api/share-link");
}

export async function regenerateShareLink(): Promise<string> {
  const response = await apiClient.post<{ token: string }>("/api/share-link/regenerate");
  return response.data.token;
}
