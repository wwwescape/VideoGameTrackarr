import { apiClient } from "./client";
import type { GameCategory } from "./types";

export type IgdbImportStatus =
  | "not_checked"
  | "match_found"
  | "in_library"
  | "several_matches"
  | "no_match"
  | "ignored";

// One custom game on Settings → IGDB Import, with what Find matches found for it on IGDB.
export interface IgdbImportEntry {
  gameId: number;
  gameUuid: string;
  gameSlug: string | null;
  gameName: string;
  gameCoverUrl: string | null;
  gameCategory: GameCategory | null;
  gameFirstReleaseDate: number | null;
  status: IgdbImportStatus;
  matchIgdbId: number | null;
  matchName: string | null;
  matchCoverUrl: string | null;
  matchFirstReleaseDate: number | null;
  matchCategory: GameCategory | null;
  exactMatchCount: number;
  checkedAt: string | null;
  // The library game the match is (status in_library): linking merges into it.
  libraryGameName: string | null;
  // Picked for the running Link job.
  queued: boolean;
}

export const IGDB_MATCH_JOB_ID = "igdb_match";
export const IGDB_LINK_JOB_ID = "igdb_link";

export async function getIgdbImportEntries(): Promise<IgdbImportEntry[]> {
  const response = await apiClient.get<IgdbImportEntry[]>("/api/igdb-import/entries");
  return response.data;
}

export async function linkIgdbImportEntry(gameId: number): Promise<void> {
  await apiClient.post(`/api/igdb-import/${gameId}/link`);
}

// Queues these games and starts the Link job; returns how many it will link.
export async function linkSelectedIgdbImportEntries(gameIds: number[]): Promise<number> {
  const response = await apiClient.post<{ count: number }>("/api/igdb-import/link", { gameIds });
  return response.data.count;
}

export async function setIgdbImportIgnored(gameIds: number[], ignored: boolean): Promise<number> {
  const response = await apiClient.post<{ count: number }>("/api/igdb-import/ignore", { gameIds, ignored });
  return response.data.count;
}
