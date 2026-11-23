import { apiClient } from "./client";
import type { GameCategory, GameRef, GameSummary } from "./types";

// Manual add-on links: an add-on linked by hand to more games than its IGDB parent (e.g. an
// FH5 car pack IGDB lists under the Standard edition only, linked to the Premium edition).
// IGDB's own link is never changed. Every call works from either side: from an add-on, the
// other ids are games; from a game, they're add-ons.

// How an add-on goes with a game: works with it, Included in it (owning the game owns the
// add-on), or a pre-order bonus for it (a label only).
export type AddonRelation = "works_with" | "included" | "preorder_bonus";

// A list row's relation to the list's own game.
export const relationOf = (game: { included?: boolean; preorderBonus?: boolean }): AddonRelation =>
  game.included ? "included" : game.preorderBonus ? "preorder_bonus" : "works_with";

// Which ids to give which relation when linking (the rest are works-with).
export interface RelationIds {
  includedIds?: number[];
  preorderBonusIds?: number[];
}

export interface AddonLinkCandidate extends GameSummary {
  // The edition of the same game an add-on candidate is for (the picker groups by it); null for
  // a game candidate.
  edition: GameRef | null;
  // Already linked: shown checked and disabled in the picker.
  linked: boolean;
  // How an already-linked one goes with it.
  linkedRelation: AddonRelation;
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

export async function addAddonLinks(gameId: number, ids: number[], relations: RelationIds = {}): Promise<number> {
  const response = await apiClient.post<{ added: number }>(`/api/games/${gameId}/addon-links`, {
    ids,
    includedIds: relations.includedIds ?? [],
    preorderBonusIds: relations.preorderBonusIds ?? [],
  });
  return response.data.added;
}

// Sets how the add-on (either id) goes with the other game. Works for an add-on's own IGDB
// parent too.
export async function setAddonRelation(gameId: number, otherId: number, relation: AddonRelation): Promise<void> {
  await apiClient.put(`/api/games/${gameId}/addon-links/${otherId}/relation`, { relation });
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
  // How it already goes with this game.
  relation: AddonRelation;
  // IGDB lists it in this game's bundle contents: the picker starts it as Included.
  suggestedIncluded: boolean;
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

export async function linkBaseGameAddons(
  gameId: number,
  igdbIds: number[],
  relations: RelationIds = {}
): Promise<BaseGameAddonResult[]> {
  const response = await apiClient.post<{ results: BaseGameAddonResult[] }>(`/api/games/${gameId}/base-game-addons`, {
    igdbIds,
    includedIgdbIds: relations.includedIds ?? [],
    preorderBonusIgdbIds: relations.preorderBonusIds ?? [],
  });
  return response.data.results;
}

// --- Packs: a Season Pass or Ultimate Pack (a custom add-on with the Pack category) holding
// other add-ons. Owning the pack, or a game it's Included in, owns what's inside.

export interface PackCandidate extends GameSummary {
  // The edition of the same game it's for; the picker groups by it.
  edition: GameRef | null;
  // Already inside (or already holding) it: shown checked and disabled.
  linked: boolean;
}

export async function listPackContents(packId: number): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/games/${packId}/pack-contents`);
  return response.data;
}

// The packs an add-on is inside.
export async function listPacks(addonId: number): Promise<GameSummary[]> {
  const response = await apiClient.get<GameSummary[]>(`/api/games/${addonId}/packs`);
  return response.data;
}

// On a pack: add-ons to put inside it. On any other add-on: packs to put it in.
export async function listPackCandidates(gameId: number, q?: string): Promise<PackCandidate[]> {
  const response = await apiClient.get<PackCandidate[]>(`/api/games/${gameId}/pack-links/candidates`, {
    params: q ? { q } : undefined,
  });
  return response.data;
}

// On a pack, puts the ids inside it; on any other add-on, puts it inside the ids (packs).
export async function addPackLinks(gameId: number, ids: number[]): Promise<number> {
  const response = await apiClient.post<{ added: number }>(`/api/games/${gameId}/pack-links`, { ids });
  return response.data.added;
}

export async function removeFromPack(packId: number, addonId: number): Promise<void> {
  await apiClient.delete(`/api/games/${packId}/pack-contents/${addonId}`);
}

// Settings → Linked Add-ons: every manual link, add-on and game.
export interface AddonLinkPair {
  addon: AddonRef;
  game: AddonRef;
  relation: AddonRelation;
  // False for the add-on's own IGDB parent: only an Included mark, nothing to unlink.
  manual: boolean;
  // The "game" is a pack the add-on is inside (always Included).
  pack?: boolean;
}

export async function listAllAddonLinks(): Promise<AddonLinkPair[]> {
  const response = await apiClient.get<AddonLinkPair[]>("/api/addon-links");
  return response.data;
}
