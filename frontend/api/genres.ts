import { apiClient } from "./client";
import type { GenreSummary } from "./types";

export async function listGenres(): Promise<GenreSummary[]> {
  const response = await apiClient.get<GenreSummary[]>("/api/genres");
  return response.data;
}
