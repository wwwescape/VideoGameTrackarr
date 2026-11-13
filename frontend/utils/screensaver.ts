import type { GameCategory, GameDetail } from "../api/types";

// The kinds of game the Games list (and so the Screensaver) shows: the backend's
// _BROWSABLE_CATEGORIES, as GameFilterDialog's GAME_TYPE_OPTIONS also lists them (a test keeps
// the two equal). Kept here so a game page needn't load the Filters dialog to check it.
export const BROWSABLE_CATEGORIES: ReadonlySet<GameCategory> = new Set<GameCategory>([
  "main_game",
  "bundle",
  "standalone_expansion",
  "remake",
  "remaster",
  "expanded_game",
  "port",
]);

// What to show (Settings → Screensaver); today's behaviour when the account isn't loaded yet.
export interface ScreensaverShowsSettings {
  owned: boolean;
  wishlist: boolean;
  custom: boolean;
}

const DEFAULT_SHOWS: ScreensaverShowsSettings = { owned: true, wishlist: false, custom: true };

// Whether a game could be in the Screensaver at all, apart from its own opt-out: a top-level
// game (no parent, a kind the Games list shows) with a cover, that you own and/or have
// wishlisted as What to show allows, and not a custom one unless those are included. The
// frontend twin of game_repository._screensaver_filter; only these get the game page's toggle.
export function canBeInScreensaver(
  game: Pick<GameDetail, "parentGameId" | "category" | "owned" | "wishlisted" | "igdbId" | "coverUrl">,
  shows: ScreensaverShowsSettings = DEFAULT_SHOWS
): boolean {
  return (
    game.parentGameId === null &&
    (game.category === null || BROWSABLE_CATEGORIES.has(game.category)) &&
    ((shows.owned && game.owned) || (shows.wishlist && game.wishlisted)) &&
    (shows.custom || game.igdbId !== null) &&
    Boolean(game.coverUrl)
  );
}
