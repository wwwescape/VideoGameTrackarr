import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameListState } from "../useGameListState";

vi.mock("../usePlatforms", () => ({ useLibraryPlatforms: () => ({ data: [], isSuccess: false }) }));
vi.mock("../useGenres", () => ({ useGenres: () => ({ data: [], isSuccess: false }) }));
vi.mock("../useTags", () => ({ useTags: () => ({ data: [], isSuccess: false }) }));
vi.mock("../useCatalogBrowse", () => ({
  useCollections: () => ({ data: [], isSuccess: false }),
  useFranchises: () => ({ data: [], isSuccess: false }),
}));
vi.mock("../useStorefronts", () => ({ useStorefronts: () => ({ data: [] }) }));

describe("useGameListState saved filters", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("puts back exactly the filters a snapshot kept, clearing the rest", () => {
    const { result } = renderHook(() => useGameListState("games", { sources: true }));

    act(() => {
      result.current.fields.onLocalPlayersMinChange(2);
      result.current.fields.onCoopOnlyChange(true);
    });
    const saved = JSON.parse(JSON.stringify(result.current.filterSnapshot));

    act(() => {
      result.current.fields.onCoopOnlyChange(false);
      result.current.fields.onRatingMinChange(85);
    });
    act(() => result.current.applyFilters(saved));

    expect(result.current.fields.localPlayersMin).toBe(2);
    expect(result.current.fields.coopOnly).toBe(true);
    expect(result.current.fields.ratingMin).toBeNull();
  });

  it("clears a filter a saved one doesn't mention, and ignores names it doesn't know", () => {
    const { result } = renderHook(() => useGameListState("games"));

    act(() => result.current.fields.onGenreIdsChange([4]));
    act(() => result.current.applyFilters({ coopOnly: true, somethingRemoved: [1] }));

    expect(result.current.fields.genreIds).toEqual([]);
    expect(result.current.fields.coopOnly).toBe(true);
  });
});
