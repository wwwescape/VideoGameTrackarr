import { apiClient } from "./client";
import type { GameCategory, GameSummary } from "./types";

// Manual add-on links: an add-on linked by hand to more games than its IGDB parent (e.g. an
// FH5 car pack IGDB lists under the Standard edition only, linked to the Premium edition).
// IGDB's own link is never changed. Every call works from either side: from an add-on, the
// other ids are games; from a game, they're add-ons.

export interface AddonLinkCandidate extends GameSummary {
  // Shares a Collection with the game; otherwise only a Series (IGDB franchise).
  sameCollection: boolean;
  // Already linked: shown checked and disabled in the picker.
  linked: boolean;
}

export interface AddonRef {
  id: number;
  uuid: string;
  slug: string | null;
  name: string;
}

// The 409 detail when removing an add-on's last link would leave it attached to nothing.
export const LAST_LINK_ORPHAN = "last_link_orphan";

// An add-on's games: its IGDB parent first, then the manually linked ones (manualLink).
export async function listWorksWith(gameId: number): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/games/${gameId}/works-with`);
  return response.data;
}

export async function listAddonLinkCandidates(gameId: number, q?: string): Promise<AddonLinkCandidate[]> {
  const response = await apiClient.get<AddonLinkCandidate[]>(`/api/games/${gameId}/addon-links/candidates`, {
    params: q ? { q } : undefined,
  });
  return response.data;
}

export async function addAddonLinks(gameId: number, ids: number[]): Promise<number> {
  const response = await apiClient.post<{ added: number }>(`/api/games/${gameId}/addon-links`, { ids });
  return response.data.added;
}

export async function removeAddonLink(gameId: number, otherId: number): Promise<void> {
  await apiClient.delete(`/api/games/${gameId}/addon-links/${otherId}`);
}

// For the Remove Game confirmation: add-ons that deleting this game keeps, detached.
export async function getRemovalPreview(gameId: number): Promise<AddonRef[]> {
  const response = await apiClient.get<{ keptAddons: AddonRef[] }>(`/api/games/${gameId}/removal-preview`);
  return response.data.keptAddons;
}

// --- Add-ons from the base game: an edition's base game on IGDB (version_parent) and its
// add-ons, read live. Picking one that isn't in VGT imports it (with no parent) and links it.

export interface BaseGameRef {
  igdbId: number;
  name: string;
  // Its local id when it's in the library too.
  gameId: number | null;
}

export interface BaseGameAddon {
  igdbId: number;
  name: string;
  coverUrl: string | null;
  category: GameCategory | null;
  firstReleaseDate: number | null;
  // Null when it isn't in VGT yet ("Will be added").
  gameId: number | null;
  linked: boolean;
}

export interface BaseGameAddons {
  // Null when IGDB doesn't record a base game for this one.
  baseGame: BaseGameRef | null;
  addons: BaseGameAddon[];
}

export interface BaseGameAddonResult {
  igdbId: number;
  status: "linked" | "already_linked" | "failed";
  gameId: number | null;
}

export async function getBaseGameAddons(gameId: number): Promise<BaseGameAddons> {
  const response = await apiClient.get<BaseGameAddons>(`/api/games/${gameId}/base-game-addons`);
  return response.data;
}

export async function linkBaseGameAddons(gameId: number, igdbIds: number[]): Promise<BaseGameAddonResult[]> {
  const response = await apiClient.post<{ results: BaseGameAddonResult[] }>(`/api/games/${gameId}/base-game-addons`, {
    igdbIds,
  });
  return response.data.results;
}

// Settings → Linked Add-ons: every manual link, add-on and game.
export interface AddonLinkPair {
  addon: AddonRef;
  game: AddonRef;
}

export async function listAllAddonLinks(): Promise<AddonLinkPair[]> {
  const response = await apiClient.get<AddonLinkPair[]>("/api/addon-links");
  return response.data;
}
