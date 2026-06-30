import { apiClient } from "./client";
import type { PlaySession, PlaySessionInput } from "./types";

export async function listPlaySessions(gameId: number): Promise<PlaySession[]> {
  const response = await apiClient.get<PlaySession[]>(`/api/games/${gameId}/play-sessions`);
  return response.data;
}

export async function createPlaySession(gameId: number, input: PlaySessionInput): Promise<PlaySession> {
  const response = await apiClient.post<PlaySession>(`/api/games/${gameId}/play-sessions`, input);
  return response.data;
}

export async function updatePlaySession(
  sessionId: number,
  input: Partial<PlaySessionInput>
): Promise<PlaySession> {
  const response = await apiClient.put<PlaySession>(`/api/play-sessions/${sessionId}`, input);
  return response.data;
}

export async function deletePlaySession(sessionId: number): Promise<void> {
  await apiClient.delete(`/api/play-sessions/${sessionId}`);
}
