import type { GameSortOption } from "../api/types";

export interface GameSortOptionItem {
  value: GameSortOption;
  labelKey: string;
}

// Shared by the Games list toolbar and the public Games share page, so both offer the
// same sort choices.
export const GAME_SORT_OPTIONS: GameSortOptionItem[] = [
  { value: "name_asc", labelKey: "games.listToolbar.sortNameAsc" },
  { value: "name_desc", labelKey: "games.listToolbar.sortNameDesc" },
  { value: "release_date_asc", labelKey: "games.listToolbar.sortReleaseDateAsc" },
  { value: "release_date_desc", labelKey: "games.listToolbar.sortReleaseDateDesc" },
];
