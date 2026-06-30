import { apiClient } from "./client";
import type { IgdbSearchResult } from "./types";

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
