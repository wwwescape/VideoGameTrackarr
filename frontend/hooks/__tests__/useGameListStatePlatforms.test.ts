import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeSessionValue } from "../../utils/sessionViewState";
import { useGameListState } from "../useGameListState";

const card = (id: number, name: string, format: "physical" | "digital" | null, storefront: string | null) => ({
  id,
  name,
  slug: null,
  abbreviation: id === 6 ? "PC" : null,
  format,
  storefront,
  ownedCount: 1,
  wishlistedCount: 0,
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => (key === "platforms.formats.physical" ? "Physical" : key) }),
}));
vi.mock("../usePlatforms", () => ({
  useLibraryPlatforms: () => ({
    data: [
      card(6, "PC (Microsoft Windows)", "digital", "Steam"),
      card(6, "PC (Microsoft Windows)", "physical", null),
      card(167, "PlayStation 5", null, null),
    ],
    isSuccess: true,
  }),
}));
vi.mock("../useGenres", () => ({ useGenres: () => ({ data: [], isSuccess: true }) }));
vi.mock("../useTags", () => ({ useTags: () => ({ data: [], isSuccess: true }) }));
vi.mock("../useCatalogBrowse", () => ({
  useCollections: () => ({ data: [], isSuccess: true }),
  useFranchises: () => ({ data: [], isSuccess: true }),
}));
vi.mock("../useStorefronts", () => ({ useStorefronts: () => ({ data: [] }) }));

describe("useGameListState platform cards", () => {
  beforeEach(() => sessionStorage.clear());

  it("offers the library's cards, PC split per storefront, and no whole PC", () => {
    const { result } = renderHook(() => useGameListState("test"));
    expect(result.current.fields.platformOptions.map((option) => option.id)).toEqual([
      "6:digital:Steam",
      "6:physical:",
      "167",
    ]);
  });

  it("keeps a preset plain PC id as a named option that survives editing the field", () => {
    writeSessionValue("test.platformIds", [6]);
    const { result } = renderHook(() => useGameListState("test"));

    expect(result.current.fields.platformKeys).toEqual(["6"]);
    expect(result.current.fields.platformOptions).toContainEqual({ id: "6", label: "PC (Microsoft Windows)" });

    // Adding PS5 in the dialog writes both back as cards: whole PC must not be pruned away.
    act(() => result.current.fields.onPlatformKeysChange(["6", "167"]));
    expect(result.current.fields.platformKeys).toEqual(["6", "167"]);
    expect(result.current.apiFilters.platformScopes).toEqual(["6", "167"]);
  });

  it("drops a remembered card the library no longer has", () => {
    writeSessionValue("test.platformScopes", ["6:digital:GOG", "167"]);
    const { result } = renderHook(() => useGameListState("test"));
    expect(result.current.fields.platformKeys).toEqual(["167"]);
  });

  it("only offers cards with physical cases on the Game Shelf", () => {
    const { result } = renderHook(() => useGameListState("test", { physicalPlatforms: true }));
    expect(result.current.fields.platformOptions.map((option) => option.id)).toEqual(["6:physical:", "167"]);
  });
});
