import { publicClient } from "./publicClient";
import type {
  GameSortOption,
  PublicAccessorySummary,
  PublicDeviceSummary,
  PublicGameDetail,
  PublicGameSummary,
} from "./types";

export async function listPublicGames(
  token: string,
  search?: string,
  sort?: GameSortOption,
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

export async function listPublicDevices(token: string, search?: string): Promise<PublicDeviceSummary[]> {
  const response = await publicClient.get<PublicDeviceSummary[]>(`/api/public/${token}/devices`, {
    params: { search: search || undefined },
  });
  return response.data;
}

export async function listPublicAccessories(token: string, search?: string): Promise<PublicAccessorySummary[]> {
  const response = await publicClient.get<PublicAccessorySummary[]>(`/api/public/${token}/accessories`, {
    params: { search: search || undefined },
  });
  return response.data;
}
