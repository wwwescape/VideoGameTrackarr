import { apiClient } from "./client";
import type { IgdbGamePreview, IgdbSearchResult } from "./types";

export async function searchIgdb(
  query: string,
  signal?: AbortSignal,
  categoryScope: "game" | "addon" = "game"
): Promise<IgdbSearchResult[]> {
  const response = await apiClient.get<IgdbSearchResult[]>("/api/igdb/search", {
    params: { query, categoryScope },
    signal,
  });
  return response.data;
}

// A read-only preview of one IGDB game (Add Game → click a result). Nothing is stored.
export async function getIgdbGamePreview(igdbId: number): Promise<IgdbGamePreview> {
  const response = await apiClient.get<IgdbGamePreview>(`/api/igdb/games/${igdbId}`);
  return response.data;
}
