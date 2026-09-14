import type { GameCategory, GameSortOption } from "../api/types";

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

// Client-side equivalent of game_repository.py's _order_by_for_sort, for lists (e.g. a
// Collection/Series browse page's Games/Addons sections) that are already fully fetched
// rather than server-side paginated/sorted. A missing release date always sorts last,
// regardless of direction — there's no "correct" position for "unknown" on either end.
export function sortGamesBy<T extends { name: string; firstReleaseDate: number | null }>(
  games: T[],
  sort: GameSortOption
): T[] {
  return [...games].sort((a, b) => {
    if (sort === "release_date_asc" || sort === "release_date_desc") {
      const aDate = a.firstReleaseDate ?? Number.POSITIVE_INFINITY;
      const bDate = b.firstReleaseDate ?? Number.POSITIVE_INFINITY;
      return sort === "release_date_asc" ? aDate - bDate : bDate - aDate;
    }
    return sort === "name_desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
  });
}

const EVENT_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// Same-day events collapse to one date instead of "Aug 24, 2026 – Aug 24, 2026".
export function formatEventDateRange(
  startTime: number | null,
  endTime: number | null
): string | null {
  if (!startTime) {
    return null;
  }

  const start = EVENT_DATE_FORMAT.format(new Date(startTime * 1000));
  if (!endTime) {
    return start;
  }

  const end = EVENT_DATE_FORMAT.format(new Date(endTime * 1000));
  return start === end ? start : `${start} – ${end}`;
}

const EVENT_DATETIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

// Date-only (formatEventDateRange above) is fine for a compact card in a grid, but loses real
// information for a single-instant event (e.g. a livestream at a specific time) — this
// includes time-of-day, in the viewer's own local timezone, for the Details page.
export function formatEventDateTime(unixSeconds: number | null): string | null {
  if (!unixSeconds) {
    return null;
  }

  return EVENT_DATETIME_FORMAT.format(new Date(unixSeconds * 1000));
}

export function formatEventDateTimeRange(startTime: number | null, endTime: number | null): string | null {
  const start = formatEventDateTime(startTime);
  if (!start) {
    return null;
  }

  const end = formatEventDateTime(endTime);
  if (!end) {
    return start;
  }

  return start === end ? start : `${start} – ${end}`;
}
