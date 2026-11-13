import { apiClient } from "./client";

export interface IntegrationsStatus {
  igdbConfigured: boolean;
  steamApiKeyConfigured: boolean;
  steamId64: string | null;
  gogConfigured: boolean;
  gogUsername: string | null;
  itadConfigured: boolean;
  itadCountry: string;
  platpricesConfigured: boolean;
  platpricesRegion: string;
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

export interface IgnoreResult {
  ignored: number;
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

export async function unignoreSteamEntry(steamAppId: number): Promise<SteamEntry> {
  const response = await apiClient.post<SteamEntry>(`/api/integrations/steam/${steamAppId}/unignore`);
  return response.data;
}

export async function ignoreSteamEntries(steamAppIds: number[]): Promise<IgnoreResult> {
  const response = await apiClient.post<IgnoreResult>("/api/integrations/steam/ignore", {
    steamAppIds,
  });
  return response.data;
}

export async function relinkSteamEntry(steamAppId: number, gameId: number): Promise<SteamEntry> {
  const response = await apiClient.post<SteamEntry>(`/api/integrations/steam/${steamAppId}/relink`, {
    gameId,
  });
  return response.data;
}

export async function unlinkSteamEntry(steamAppId: number): Promise<SteamEntry> {
  const response = await apiClient.post<SteamEntry>(`/api/integrations/steam/${steamAppId}/unlink`);
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

export async function unignoreSteamWishlistEntry(steamAppId: number): Promise<SteamWishlistEntry> {
  const response = await apiClient.post<SteamWishlistEntry>(
    `/api/integrations/steam/wishlist/${steamAppId}/unignore`
  );
  return response.data;
}

export async function ignoreSteamWishlistEntries(steamAppIds: number[]): Promise<IgnoreResult> {
  const response = await apiClient.post<IgnoreResult>("/api/integrations/steam/wishlist/ignore", {
    steamAppIds,
  });
  return response.data;
}

export async function relinkSteamWishlistEntry(
  steamAppId: number,
  gameId: number
): Promise<SteamWishlistEntry> {
  const response = await apiClient.post<SteamWishlistEntry>(
    `/api/integrations/steam/wishlist/${steamAppId}/relink`,
    { gameId }
  );
  return response.data;
}

export async function unlinkSteamWishlistEntry(steamAppId: number): Promise<SteamWishlistEntry> {
  const response = await apiClient.post<SteamWishlistEntry>(
    `/api/integrations/steam/wishlist/${steamAppId}/unlink`
  );
  return response.data;
}

export type GogEntryStatus = "no_match" | "new" | "up_to_date" | "ignored";

export interface GogEntry {
  gogProductId: number;
  gogName: string;
  status: GogEntryStatus;
  gameId: number | null;
  gameName: string | null;
  gameSlug: string | null;
  gameCoverUrl: string | null;
  parentGameId: number | null;
}

export interface GogStatus {
  configured: boolean;
  username: string | null;
  authorizeUrl: string;
}

export interface GogSyncResult {
  synced: number;
  failed: number;
  failures: { gogProductId: number; error: string }[];
}

export interface GogIgnoreResult {
  ignored: number;
  failed: number;
  failures: { gogProductId: number; error: string }[];
}

export type GogDownloadState = "not_downloaded" | "queued" | "downloading" | "completed" | "failed";

export interface GogInstallerFile {
  id: string;
  size: number;
  downloadState: GogDownloadState;
  downloadedBytes: number;
  downloadError: string | null;
}

export interface GogInstaller {
  id: string;
  os: string;
  language: string;
  version: string | null;
  totalSize: number;
  files: GogInstallerFile[];
}

export interface GogInstallerGroup {
  productId: number;
  title: string;
  installers: GogInstaller[];
}

export interface GogInstallers {
  gameId: number;
  gogProductId: number;
  groups: GogInstallerGroup[];
}

export interface GogDownload {
  fileId: string;
  status: string;
  totalSize: number;
  downloadedBytes: number;
  filename: string | null;
  error: string | null;
}

export async function getGogStatus(): Promise<GogStatus> {
  const response = await apiClient.get<GogStatus>("/api/integrations/gog/status");
  return response.data;
}

export async function connectGog(redirectUrl: string): Promise<GogStatus> {
  const response = await apiClient.post<GogStatus>("/api/integrations/gog/connect", {
    redirectUrl,
  });
  return response.data;
}

export async function disconnectGog(): Promise<GogStatus> {
  const response = await apiClient.post<GogStatus>("/api/integrations/gog/disconnect");
  return response.data;
}

export async function getGogEntries(): Promise<GogEntry[]> {
  const response = await apiClient.get<GogEntry[]>("/api/integrations/gog/entries");
  return response.data;
}

export async function syncGogEntries(gogProductIds: number[]): Promise<GogSyncResult> {
  const response = await apiClient.post<GogSyncResult>("/api/integrations/gog/sync", {
    gogProductIds,
  });
  return response.data;
}

export async function ignoreGogEntries(gogProductIds: number[]): Promise<GogIgnoreResult> {
  const response = await apiClient.post<GogIgnoreResult>("/api/integrations/gog/ignore", {
    gogProductIds,
  });
  return response.data;
}

export async function ignoreGogEntry(gogProductId: number): Promise<GogEntry> {
  const response = await apiClient.post<GogEntry>(`/api/integrations/gog/${gogProductId}/ignore`);
  return response.data;
}

export async function unignoreGogEntry(gogProductId: number): Promise<GogEntry> {
  const response = await apiClient.post<GogEntry>(`/api/integrations/gog/${gogProductId}/unignore`);
  return response.data;
}

export async function relinkGogEntry(gogProductId: number, gameId: number): Promise<GogEntry> {
  const response = await apiClient.post<GogEntry>(`/api/integrations/gog/${gogProductId}/relink`, {
    gameId,
  });
  return response.data;
}

export async function unlinkGogEntry(gogProductId: number): Promise<GogEntry> {
  const response = await apiClient.post<GogEntry>(`/api/integrations/gog/${gogProductId}/unlink`);
  return response.data;
}

export async function getGogInstallers(gameId: number): Promise<GogInstallers> {
  const response = await apiClient.get<GogInstallers>(
    `/api/integrations/gog/games/${gameId}/installers`
  );
  return response.data;
}

export async function queueGogInstallerDownload(
  gameId: number,
  installerId: string,
  fileId: string
): Promise<GogDownload> {
  const response = await apiClient.post<GogDownload>(
    `/api/integrations/gog/games/${gameId}/installers/queue`,
    { installerId, fileId }
  );
  return response.data;
}

export async function getGogInstallerFileLink(gameId: number, fileId: string): Promise<string> {
  const response = await apiClient.post<{ url: string }>(
    `/api/integrations/gog/games/${gameId}/installers/${fileId}/file-link`
  );
  return response.data.url;
}
