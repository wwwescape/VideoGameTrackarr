import { apiClient } from "./client";

export interface IntegrationsStatus {
  igdbConfigured: boolean;
  steamApiKeyConfigured: boolean;
  steamId64: string | null;
  itadConfigured: boolean;
  itadCountry: string;
  platpricesConfigured: boolean;
  platpricesRegion: string;
  gogConnected: boolean;
  gogUsername: string | null;
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

// --- GOG Sync -------------------------------------------------------------------------------

export interface GogStatus {
  connected: boolean;
  username: string | null;
  // GOG's sign-in page, opened in a popup from Settings → Integrations.
  loginUrl: string;
}

// No "update_available": GOG has no playtime to bring over.
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

// The wishlist rows: "already_wishlisted" when VGT already has the game on its wishlist.
export type GogWishlistEntryStatus = "no_match" | "new" | "already_wishlisted" | "ignored";

export type GogWishlistEntry = Omit<GogEntry, "status"> & { status: GogWishlistEntryStatus };

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

export type GogStoreDetails = SteamStoreDetails;

export async function getGogStatus(): Promise<GogStatus> {
  const response = await apiClient.get<GogStatus>("/api/integrations/gog");
  return response.data;
}

export async function connectGog(redirectUrl: string): Promise<GogStatus> {
  const response = await apiClient.post<GogStatus>("/api/integrations/gog/connect", { redirectUrl });
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
  const response = await apiClient.post<GogSyncResult>("/api/integrations/gog/sync", { gogProductIds });
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

export async function ignoreGogEntries(gogProductIds: number[]): Promise<GogIgnoreResult> {
  const response = await apiClient.post<GogIgnoreResult>("/api/integrations/gog/ignore", { gogProductIds });
  return response.data;
}

export async function relinkGogEntry(gogProductId: number, gameId: number): Promise<GogEntry> {
  const response = await apiClient.post<GogEntry>(`/api/integrations/gog/${gogProductId}/relink`, { gameId });
  return response.data;
}

export async function unlinkGogEntry(gogProductId: number): Promise<GogEntry> {
  const response = await apiClient.post<GogEntry>(`/api/integrations/gog/${gogProductId}/unlink`);
  return response.data;
}

export async function getGogStoreDetails(gogProductId: number): Promise<GogStoreDetails> {
  const response = await apiClient.get<GogStoreDetails>(`/api/integrations/gog/${gogProductId}/store-details`);
  return response.data;
}

export async function getGogWishlistEntries(): Promise<GogWishlistEntry[]> {
  const response = await apiClient.get<GogWishlistEntry[]>("/api/integrations/gog/wishlist/entries");
  return response.data;
}

export async function syncGogWishlistEntries(gogProductIds: number[]): Promise<GogSyncResult> {
  const response = await apiClient.post<GogSyncResult>("/api/integrations/gog/wishlist/sync", { gogProductIds });
  return response.data;
}

export async function ignoreGogWishlistEntry(gogProductId: number): Promise<GogWishlistEntry> {
  const response = await apiClient.post<GogWishlistEntry>(`/api/integrations/gog/wishlist/${gogProductId}/ignore`);
  return response.data;
}

export async function unignoreGogWishlistEntry(gogProductId: number): Promise<GogWishlistEntry> {
  const response = await apiClient.post<GogWishlistEntry>(`/api/integrations/gog/wishlist/${gogProductId}/unignore`);
  return response.data;
}

export async function ignoreGogWishlistEntries(gogProductIds: number[]): Promise<GogIgnoreResult> {
  const response = await apiClient.post<GogIgnoreResult>("/api/integrations/gog/wishlist/ignore", { gogProductIds });
  return response.data;
}

export async function relinkGogWishlistEntry(gogProductId: number, gameId: number): Promise<GogWishlistEntry> {
  const response = await apiClient.post<GogWishlistEntry>(`/api/integrations/gog/wishlist/${gogProductId}/relink`, {
    gameId,
  });
  return response.data;
}

export async function unlinkGogWishlistEntry(gogProductId: number): Promise<GogWishlistEntry> {
  const response = await apiClient.post<GogWishlistEntry>(`/api/integrations/gog/wishlist/${gogProductId}/unlink`);
  return response.data;
}

// --- GOG offline installers -------------------------------------------------------------------

export type GogPartState = "not_downloaded" | "queued" | "downloading" | "completed" | "failed";

export interface GogInstallerPart {
  id: string;
  size: number;
  downloadId: number | null;
  state: GogPartState;
  downloadedBytes: number;
  error: string | null;
  filename: string | null;
}

export interface GogInstaller {
  id: string;
  os: string;
  language: string;
  version: string | null;
  totalSize: number;
  files: GogInstallerPart[];
}

export interface GogInstallerGroup {
  productId: number;
  title: string;
  installers: GogInstaller[];
}

export interface GogInstallers {
  gameId: number;
  groups: GogInstallerGroup[];
}

export interface GogDownload {
  id: number;
  gameId: number;
  gameName: string | null;
  gameSlug: string | null;
  productId: number;
  installerId: string;
  fileId: string;
  filename: string | null;
  status: Exclude<GogPartState, "not_downloaded">;
  totalSize: number;
  downloadedBytes: number;
  error: string | null;
}

export interface GogDownloads {
  downloads: GogDownload[];
  bytesOnDisk: number;
}

export async function getGogInstallers(gameId: number): Promise<GogInstallers> {
  const response = await apiClient.get<GogInstallers>(`/api/integrations/gog/games/${gameId}/installers`);
  return response.data;
}

export async function downloadGogInstaller(
  gameId: number,
  productId: number,
  installerId: string
): Promise<GogInstallers> {
  const response = await apiClient.post<GogInstallers>(`/api/integrations/gog/games/${gameId}/installers/download`, {
    productId,
    installerId,
  });
  return response.data;
}

export async function getGogDownloads(): Promise<GogDownloads> {
  const response = await apiClient.get<GogDownloads>("/api/integrations/gog/downloads");
  return response.data;
}

export async function retryGogDownload(downloadId: number): Promise<GogDownload> {
  const response = await apiClient.post<GogDownload>(`/api/integrations/gog/downloads/${downloadId}/retry`);
  return response.data;
}

export async function deleteGogDownload(downloadId: number): Promise<void> {
  await apiClient.delete(`/api/integrations/gog/downloads/${downloadId}`);
}

// Installers can be many GB, so they aren't fetched into a Blob: the server hands out a
// short-lived signed link and the browser saves the file itself.
export async function createGogDownloadLink(downloadId: number): Promise<string> {
  const response = await apiClient.post<{ url: string }>(`/api/integrations/gog/downloads/${downloadId}/file-link`);
  return response.data.url;
}
