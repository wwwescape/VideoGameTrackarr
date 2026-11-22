import type { GameDetail } from "../api/types";

// A custom add-on's single Store URL: recognised by its host, like the server does
// (backend/app/services/store_urls.py — keep the two lists in step), and stored in that store's
// own link, so it shows the same store icon an IGDB game's link would.
export type StoreKey = "steam" | "xbox" | "playstation" | "nintendo" | "epic" | "gog";

const STORE_HOSTS: Record<StoreKey, string[]> = {
  steam: ["steampowered.com", "steamcommunity.com"],
  xbox: ["xbox.com", "microsoft.com"],
  playstation: ["playstation.com"],
  nintendo: [
    "nintendo.com",
    "nintendo.co.uk",
    "nintendo.co.jp",
    "nintendo.de",
    "nintendo.fr",
    "nintendo.es",
    "nintendo.it",
    "nintendo.nl",
    "nintendo.com.au",
    "nintendo.co.nz",
  ],
  epic: ["epicgames.com"],
  gog: ["gog.com"],
};

export const STORE_NAMES: Record<StoreKey, string> = {
  steam: "Steam",
  xbox: "Xbox",
  playstation: "PlayStation",
  nintendo: "Nintendo",
  epic: "Epic Games",
  gog: "GOG",
};

// The store a link belongs to, or null when it isn't an http(s) link to a known store.
export function detectStore(url: string): StoreKey | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  for (const [store, suffixes] of Object.entries(STORE_HOSTS) as [StoreKey, string[]][]) {
    if (suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return store;
  }
  return null;
}

// A custom game's current Store URL: whichever store link it has.
export function currentStoreUrl(
  game: Pick<
    GameDetail,
    | "steamStoreUrl"
    | "xboxStoreUrl"
    | "playstationStoreUrl"
    | "nintendoStoreUrl"
    | "epicGamesStoreUrl"
    | "gogStoreUrl"
  >
): string {
  return (
    game.steamStoreUrl ??
    game.xboxStoreUrl ??
    game.playstationStoreUrl ??
    game.nintendoStoreUrl ??
    game.epicGamesStoreUrl ??
    game.gogStoreUrl ??
    ""
  );
}
