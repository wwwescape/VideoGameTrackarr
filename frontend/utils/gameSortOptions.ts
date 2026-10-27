import type { GameSortOption } from "../api/types";
import type { SortDirection } from "./listSort";

// What a game list can be sorted by: the Table view's columns, plus Date added. A sort is a
// field and a direction, sent to the server as "<field>_<direction>" (GameSortOption).
export type GameSortField =
  | "name"
  | "date_added"
  | "type"
  | "release_date"
  | "platforms"
  | "play_status"
  | "rating"
  | "library"
  | "labels";

export interface GameSortFieldItem {
  field: GameSortField;
  labelKey: string;
  // The direction a field starts in when picked (newest and highest rated first).
  defaultDirection: SortDirection;
}

// In the Sort menu's order. Shared by the Games list toolbar, the Table view's headers and the
// public Games share page (which offers only PUBLIC_SORT_FIELDS).
export const GAME_SORT_FIELDS: GameSortFieldItem[] = [
  { field: "name", labelKey: "games.listView.columnName", defaultDirection: "asc" },
  { field: "date_added", labelKey: "games.listView.sortDateAdded", defaultDirection: "desc" },
  { field: "type", labelKey: "games.listView.columnType", defaultDirection: "asc" },
  { field: "release_date", labelKey: "games.listView.columnYear", defaultDirection: "asc" },
  { field: "platforms", labelKey: "games.listView.columnPlatforms", defaultDirection: "asc" },
  { field: "play_status", labelKey: "games.listToolbar.playStatusLabel", defaultDirection: "asc" },
  { field: "rating", labelKey: "games.listView.columnRating", defaultDirection: "desc" },
  { field: "library", labelKey: "games.listView.columnLibrary", defaultDirection: "asc" },
  { field: "labels", labelKey: "games.listView.columnLabels", defaultDirection: "asc" },
];

// The share page doesn't show copies, progress, ratings or sales, and the server ignores
// those sorts there.
export const PUBLIC_SORT_FIELDS: GameSortField[] = ["name", "date_added", "type", "release_date", "library"];

export function gameSortField(sort: GameSortOption): GameSortField {
  return sort.replace(/_(asc|desc)$/, "") as GameSortField;
}

export function gameSortDirection(sort: GameSortOption): SortDirection {
  return sort.endsWith("_desc") ? "desc" : "asc";
}

export function makeGameSort(field: GameSortField, direction: SortDirection): GameSortOption {
  return `${field}_${direction}` as GameSortOption;
}

// Picking a field in the Sort menu: a new field starts in its default direction.
export function pickGameSortField(current: GameSortOption, field: GameSortField): GameSortOption {
  if (gameSortField(current) === field) return current;
  const item = GAME_SORT_FIELDS.find((option) => option.field === field);
  return makeGameSort(field, item?.defaultDirection ?? "asc");
}

// Clicking a column header: the sorted column flips its direction, another one starts in its
// default.
export function nextGameSort(current: GameSortOption, field: GameSortField): GameSortOption {
  if (gameSortField(current) === field) {
    return makeGameSort(field, gameSortDirection(current) === "asc" ? "desc" : "asc");
  }
  return pickGameSortField(current, field);
}
