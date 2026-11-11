import { publicClient } from "./publicClient";
import type {
  GameSortOption,
  PublicAccessorySummary,
  PublicDeviceSummary,
  PublicGameDetail,
  PublicGameShelf,
  PublicGameSummary,
} from "./types";

export async function listPublicGames(
  token: string,
  search?: string,
  sort?: GameSortOption
): Promise<PublicGameSummary[]> {
  const response = await publicClient.get<PublicGameSummary[]>(`/api/public/${token}/games`, {
    params: { search: search || undefined, sort },
  });
  return response.data;
}

export async function getPublicGame(token: string, gameId: number): Promise<PublicGameDetail> {
  const response = await publicClient.get<PublicGameDetail>(`/api/public/${token}/games/${gameId}`);
  return response.data;
}

export async function listPublicDevices(
  token: string,
  search?: string
): Promise<PublicDeviceSummary[]> {
  const response = await publicClient.get<PublicDeviceSummary[]>(`/api/public/${token}/devices`, {
    params: { search: search || undefined },
  });
  return response.data;
}

export async function listPublicAccessories(
  token: string,
  search?: string
): Promise<PublicAccessorySummary[]> {
  const response = await publicClient.get<PublicAccessorySummary[]>(
    `/api/public/${token}/accessories`,
    {
      params: { search: search || undefined },
    }
  );
  return response.data;
}

// The share page's Game Shelf: search and the public sorts, like its Games tab.
export async function getPublicShelf(
  token: string,
  search?: string,
  sort?: GameSortOption
): Promise<PublicGameShelf> {
  const response = await publicClient.get<PublicGameShelf>(`/api/public/${token}/shelf`, {
    params: { search: search || undefined, sort },
  });
  return response.data;
}

// The labs that are on, so the share page shows their tabs (the Game Shelf's).
export async function getPublicLabs(token: string): Promise<{ enabled: string[] }> {
  const response = await publicClient.get<{ enabled: string[] }>(`/api/public/${token}/labs`);
  return response.data;
}
