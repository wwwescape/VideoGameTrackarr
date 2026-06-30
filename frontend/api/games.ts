import { apiClient } from "./client";
import type { GameDetail, GameSummary, ManualGameInput } from "./types";

export async function listGames(search?: string, signal?: AbortSignal): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>("/api/games", {
    params: search ? { search } : undefined,
    signal,
  });
  return response.data;
}

export async function getGame(identifier: string): Promise<GameDetail> {
  const response = await apiClient.get<GameDetail>(`/api/games/${identifier}`);
  return response.data;
}

export async function listAddons(gameId: number): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/games/${gameId}/addons`);
  return response.data;
}

export async function deleteGame(gameId: number): Promise<void> {
  await apiClient.delete(`/api/games/${gameId}`);
}

export async function importGame(igdbId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>("/api/games", { igdbId });
  return response.data;
}

export async function resyncGame(gameId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/resync`);
  return response.data;
}

export async function linkGameToIgdb(gameId: number, igdbId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/link-igdb`, { igdbId });
  return response.data;
}

export async function linkGameToIgdbViaParent(gameId: number, igdbId: number): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>(`/api/games/${gameId}/link-igdb-via-parent`, { igdbId });
  return response.data;
}

export async function createManualGame(input: ManualGameInput): Promise<GameDetail> {
  const response = await apiClient.post<GameDetail>("/api/games/manual", input);
  return response.data;
}

export async function updateManualGame(gameId: number, input: Partial<ManualGameInput>): Promise<GameDetail> {
  const response = await apiClient.patch<GameDetail>(`/api/games/${gameId}/manual`, input);
  return response.data;
}
