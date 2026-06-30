import type { GameCategory } from "../api/types";

export function getReleaseYear(value: number | null | undefined): number | null {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).getFullYear();
}

const ADDON_TYPE_LABELS: Partial<Record<GameCategory, string>> = {
  dlc_addon: "DLC",
  expansion: "Expansion",
  pack: "Pack",
  standalone_expansion: "Standalone Expansion",
  bundle: "Bundle",
  episode: "Episode",
  season: "Season",
  remake: "Remake",
  remaster: "Remaster",
  expanded_game: "Expanded Game",
  port: "Port",
  fork: "Fork",
  update: "Update",
  mod: "Mod",
};

export function getAddonType(gameOrAddon: { category?: GameCategory | null }): string | undefined {
  if (!gameOrAddon.category) {
    return undefined;
  }

  return ADDON_TYPE_LABELS[gameOrAddon.category];
}

export function isAddon(gameOrAddon: { category?: GameCategory | null }): boolean {
  return Boolean(gameOrAddon.category) && gameOrAddon.category !== "main_game";
}
