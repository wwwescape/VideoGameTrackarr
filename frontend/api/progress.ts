import { apiClient } from "./client";
import type { GameProgress, GameProgressUpdateInput } from "./types";

export async function getGameProgress(gameId: number): Promise<GameProgress> {
  const response = await apiClient.get<GameProgress>(`/api/games/${gameId}/progress`);
  return response.data;
}

export async function updateGameProgress(gameId: number, input: GameProgressUpdateInput): Promise<GameProgress> {
  const response = await apiClient.put<GameProgress>(`/api/games/${gameId}/progress`, input);
  return response.data;
}
