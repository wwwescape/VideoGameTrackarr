import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePreferences } from "../api/auth";
import type { SavedGameFilter } from "../api/types";
import { currentUserQueryKey, useCurrentUser } from "./useAuth";

// Every field of the game list's Filter dialog (GameFilterDialog), in its order. A key added
// here shows up by default, since only hidden fields are worth remembering.
export const GAME_FILTER_FIELD_KEYS = [
  "gameType",
  "tag",
  "ownership",
  "playStatus",
  "platform",
  "format",
  "steelbook",
  "collection",
  "series",
  "source",
  "genre",
  "release",
  "localPlayers",
  "timeToBeat",
  "rating",
  "onlineMultiplayer",
  "coop",
] as const;

export type GameFilterFieldKey = (typeof GAME_FILTER_FIELD_KEYS)[number];

// Each field's label, the same one the dialog shows on it.
export const GAME_FILTER_FIELD_LABEL_KEYS: Record<GameFilterFieldKey, string> = {
  gameType: "games.listToolbar.gameTypeLabel",
  tag: "games.listToolbar.tagLabel",
  ownership: "games.listToolbar.ownershipLabel",
  playStatus: "games.listToolbar.playStatusLabel",
  platform: "games.listToolbar.consoleLabel",
  format: "games.listToolbar.formatLabel",
  steelbook: "games.listToolbar.steelbookOnlyLabel",
  collection: "games.listToolbar.collectionLabel",
  series: "games.listToolbar.seriesLabel",
  source: "games.listToolbar.sourceLabel",
  genre: "games.listToolbar.genreLabel",
  release: "games.listToolbar.releaseStatusLabel",
  localPlayers: "games.listToolbar.localPlayersLabel",
  timeToBeat: "games.listToolbar.timeToBeatLabel",
  rating: "games.listToolbar.ratingLabel",
  onlineMultiplayer: "games.listToolbar.onlineMultiplayerOnlyLabel",
  coop: "games.listToolbar.coopOnlyLabel",
};

const NO_SAVED_FILTERS: SavedGameFilter[] = [];

// Which Filter dialog fields are switched off, and the game list views: filters saved under a
// name ("Couch co-op"). Both are kept on the account, like the Overview layout, so every browser has them.
export function useGameFilterPreferences() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const hiddenFields = useMemo(
    () =>
      new Set(
        (user?.gameFilterFields ?? [])
          .filter((field) => field.hidden)
          .map((field) => field.key)
          .filter((key): key is GameFilterFieldKey =>
            (GAME_FILTER_FIELD_KEYS as readonly string[]).includes(key)
          )
      ),
    [user?.gameFilterFields]
  );
  const savedFilters = user?.savedGameFilters ?? NO_SAVED_FILTERS;
  const save = useMutation({
    mutationFn: updatePreferences,
    onSuccess: (updated) => queryClient.setQueryData(currentUserQueryKey, updated),
  });

  const setHiddenFields = (hidden: Set<GameFilterFieldKey>) =>
    save.mutate({
      gameFilterFields: GAME_FILTER_FIELD_KEYS.map((key) => ({ key, hidden: hidden.has(key) })),
    });

  const sorted = (filters: SavedGameFilter[]) =>
    [...filters].sort((a, b) => a.name.localeCompare(b.name));

  // Saving under a name that's already taken replaces that view.
  const saveFilter = (name: string, filters: Record<string, unknown>) =>
    save.mutate({
      savedGameFilters: sorted([
        ...savedFilters.filter((saved) => saved.name !== name),
        { name, filters },
      ]),
    });

  // Renaming onto another view's name replaces that one, the same as saving over it.
  const renameFilter = (from: string, to: string) => {
    const renamed = savedFilters.find((saved) => saved.name === from);
    if (!renamed || from === to) return;
    save.mutate({
      savedGameFilters: sorted([
        ...savedFilters.filter((saved) => saved.name !== from && saved.name !== to),
        { ...renamed, name: to },
      ]),
    });
  };

  // Gone at once; the caller offers Undo, which saves it back (restoreFilter).
  const deleteFilter = (name: string) =>
    save.mutate({ savedGameFilters: savedFilters.filter((saved) => saved.name !== name) });

  const restoreFilter = (saved: SavedGameFilter) => saveFilter(saved.name, saved.filters);

  return {
    hiddenFields,
    setHiddenFields,
    savedFilters,
    saveFilter,
    renameFilter,
    deleteFilter,
    restoreFilter,
    saving: save.isPending,
    saveError: save.isError,
  };
}
