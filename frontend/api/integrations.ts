import { apiClient } from "./client";

export interface IntegrationsStatus {
  igdbConfigured: boolean;
  steamApiKeyConfigured: boolean;
  steamId64: string | null;
  itadConfigured: boolean;
  platpricesConfigured: boolean;
}

export async function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  const response = await apiClient.get<IntegrationsStatus>("/api/integrations");
  return response.data;
}

export async function updateSteamId(steamId64: string | null): Promise<IntegrationsStatus> {
  const response = await apiClient.put<IntegrationsStatus>("/api/integrations/steam", {
    steamId64,
  });
  return response.data;
}

export type SteamEntryStatus = "no_match" | "new" | "update_available" | "up_to_date" | "ignored";

export interface SteamEntry {
  steamAppId: number;
  steamName: string;
  steamPlaytimeMinutes: number;
  steamLastPlayedAt: string | null;
  status: SteamEntryStatus;
  gameId: number | null;
  gameName: string | null;
  gameSlug: string | null;
  gameCoverUrl: string | null;
  vgtPlaytimeMinutes: number | null;
  // The matched game's parent (if any) — lets the Steam Sync page nest a DLC/expansion/pack
  // row under its parent's row instead of listing it flat.
  parentGameId: number | null;
}

export type SteamWishlistEntryStatus = "no_match" | "new" | "already_wishlisted" | "ignored";

export interface SteamWishlistEntry {
  steamAppId: number;
  steamName: string;
  wishlistAddedAt: string | null;
  status: SteamWishlistEntryStatus;
  gameId: number | null;
  gameName: string | null;
  gameSlug: string | null;
  gameCoverUrl: string | null;
  parentGameId: number | null;
}

export interface SyncResult {
  synced: number;
  failed: number;
  failures: { steamAppId: number; error: string }[];
}

export interface SteamStoreDetails {
  name: string;
  summary: string | null;
  coverUrl: string | null;
}

export async function getSteamEntries(): Promise<SteamEntry[]> {
  const response = await apiClient.get<SteamEntry[]>("/api/integrations/steam/entries");
  return response.data;
}

export async function syncSteamEntries(steamAppIds: number[]): Promise<SyncResult> {
  const response = await apiClient.post<SyncResult>("/api/integrations/steam/sync", {
    steamAppIds,
  });
  return response.data;
}

export async function ignoreSteamEntry(steamAppId: number): Promise<SteamEntry> {
  const response = await apiClient.post<SteamEntry>(`/api/integrations/steam/${steamAppId}/ignore`);
  return response.data;
}

export async function getSteamStoreDetails(steamAppId: number): Promise<SteamStoreDetails> {
  const response = await apiClient.get<SteamStoreDetails>(
    `/api/integrations/steam/${steamAppId}/store-details`
  );
  return response.data;
}

export async function getSteamWishlistEntries(): Promise<SteamWishlistEntry[]> {
  const response = await apiClient.get<SteamWishlistEntry[]>("/api/integrations/steam/wishlist/entries");
  return response.data;
}

export async function syncSteamWishlistEntries(steamAppIds: number[]): Promise<SyncResult> {
  const response = await apiClient.post<SyncResult>("/api/integrations/steam/wishlist/sync", {
    steamAppIds,
  });
  return response.data;
}

export async function ignoreSteamWishlistEntry(steamAppId: number): Promise<SteamWishlistEntry> {
  const response = await apiClient.post<SteamWishlistEntry>(
    `/api/integrations/steam/wishlist/${steamAppId}/ignore`
  );
  return response.data;
}
