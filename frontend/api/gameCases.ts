import { apiClient } from "./client";
import type { GameCase } from "./types";

// Settings > Game Cases (Game Shelf lab): the predefined game cases and their Show on shelf switch.
export async function listGameCases(): Promise<GameCase[]> {
  const response = await apiClient.get<GameCase[]>("/api/game-cases");
  return response.data;
}

export async function setGameCaseShown(id: number, shown: boolean): Promise<GameCase> {
  const response = await apiClient.put<GameCase>(`/api/game-cases/${id}`, { shown });
  return response.data;
}
