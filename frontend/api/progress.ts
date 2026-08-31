import { apiClient } from "./client";
import type { GameProgress, GameProgressCreateInput, GameProgressUpdateInput } from "./types";

export async function listGameProgress(gameId: number): Promise<GameProgress[]> {
  const response = await apiClient.get<GameProgress[]>(`/api/games/${gameId}/progress`);
  return response.data;
}

export async function createGameProgress(
  gameId: number,
  input: GameProgressCreateInput
): Promise<GameProgress> {
  const response = await apiClient.post<GameProgress>(`/api/games/${gameId}/progress`, input);
  return response.data;
}

export async function updateGameProgress(
  progressId: number,
  input: GameProgressUpdateInput
): Promise<GameProgress> {
  const response = await apiClient.put<GameProgress>(`/api/progress/${progressId}`, input);
  return response.data;
}

export async function deleteGameProgress(progressId: number): Promise<void> {
  await apiClient.delete(`/api/progress/${progressId}`);
}
