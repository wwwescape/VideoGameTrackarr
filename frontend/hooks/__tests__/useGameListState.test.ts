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

  it("keeps the Screensaver filter in a preset", () => {
    const { result } = renderHook(() => useGameListState("games", { screensaver: true }));

    act(() => result.current.fields.onScreensaverFilterChange?.("hidden"));
    const saved = JSON.parse(JSON.stringify(result.current.snapshotFilters()));
    expect(saved.screensaverFilter).toBe("hidden");

    act(() => result.current.fields.onScreensaverFilterChange?.(null));
    expect(result.current.matchesFilters(saved)).toBe(false);
    act(() => result.current.applyFilters(saved));
    expect(result.current.fields.screensaverFilter).toBe("hidden");
  });

  it("keeps Include add-ons in a preset", () => {
    const { result } = renderHook(() => useGameListState("games", { includeAddons: true }));

    act(() => result.current.fields.onIncludeAddonsChange?.(true));
    const saved = JSON.parse(JSON.stringify(result.current.snapshotFilters()));
    expect(saved.includeAddons).toBe(true);

    act(() => result.current.fields.onIncludeAddonsChange?.(false));
    expect(result.current.matchesFilters(saved)).toBe(false);
    act(() => result.current.applyFilters(saved));
    expect(result.current.fields.includeAddons).toBe(true);
  });

  it("leaves the fields a page fixes alone: not saved, not compared, not put back", () => {
    // Like a Platform page: its own platform filter has no field or chip there.
    const { result } = renderHook(() => useGameListState("platform.ps5"));

    act(() => {
      result.current.fields.onCoopOnlyChange(true);
      result.current.fields.onCollectionIdsChange([7]);
    });
    const saved = result.current.snapshotFilters(["collection"]);
    expect(saved).not.toHaveProperty("collectionIds");
    expect(saved).toHaveProperty("coopOnly", true);
    expect(result.current.matchesFilters({ coopOnly: true }, ["collection"])).toBe(true);

    act(() => result.current.applyFilters({ platformScopes: ["130"], collectionIds: [9] }, ["platform", "collection"]));
    expect(result.current.fields.platformKeys).toEqual([]);
    expect(result.current.fields.collectionIds).toEqual([7]);
    expect(result.current.fields.coopOnly).toBe(false);
  });
});
