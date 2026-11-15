import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogResyncStatus, GameSummary } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import CatalogBrowseGrid from "../CatalogBrowseGrid";

const game = (id: number, name: string, overrides: Partial<GameSummary> = {}): GameSummary =>
  ({
    id,
    uuid: `uuid-${id}`,
    igdbId: id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    coverUrl: null,
    category: "main_game",
    firstReleaseDate: null,
    owned: true,
    wishlisted: false,
    playStatus: null,
    rating: null,
    isOnSale: false,
    autoDiscovered: false,
    libraryPlatforms: [],
    playable: false,
    ...overrides,
  }) as GameSummary;

const GAMES = [game(1, "Zelda"), game(2, "Zelda II", { owned: false })];
const ADDONS = [game(10, "Master Quest", { category: "dlc_addon" })];

vi.mock("../../hooks/useGames", () => ({ useGames: () => ({ data: GAMES, isLoading: false }) }));
const useCollectionAddonsMock = vi.fn((_slug: unknown, _filters: unknown, enabled: boolean) => ({
  data: enabled ? ADDONS : undefined,
  isLoading: false,
}));
vi.mock("../../hooks/useCatalogBrowse", () => ({
  useCollections: () => ({ data: [], isSuccess: true }),
  useFranchises: () => ({ data: [], isSuccess: true }),
  useCollectionAddons: (slug: unknown, filters: unknown, enabled: boolean) => useCollectionAddonsMock(slug, filters, enabled),
  useFranchiseAddons: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: [], isSuccess: true }),
  useLibraryPlatforms: () => ({ data: [], isSuccess: true }),
  usePlatformAddons: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../../hooks/useGenres", () => ({ useGenres: () => ({ data: [], isSuccess: true }) }));
vi.mock("../../hooks/useGameFilterPreferences", () => ({
  useGameFilterPreferences: () => ({ hiddenFields: new Set(), savedFilters: [], saveFilter: vi.fn(), deleteFilter: vi.fn() }),
}));
vi.mock("../../hooks/useTags", () => ({ useTags: () => ({ data: [], isSuccess: true }) }));
vi.mock("../../hooks/useStorefronts", () => ({ useStorefronts: () => ({ data: [] }) }));

let resyncStatus: CatalogResyncStatus | undefined;
vi.mock("../../hooks/useCatalogResync", () => ({
  useCatalogResyncStatus: () => ({ data: resyncStatus }),
  useStartCollectionResync: () => ({ mutate: vi.fn(), isPending: false }),
  useStartFranchiseResync: () => ({ mutate: vi.fn(), isPending: false }),
  useAcknowledgeCatalogResyncStatus: () => ({ mutate: vi.fn() }),
}));

// Render every card plainly — virtualisation isn't what's under test here.
vi.mock("../VirtualGameGrid", () => ({
  default: <T,>({ items, getKey, renderItem }: { items: T[]; getKey: (item: T) => number; renderItem: (item: T) => ReactNode }) => (
    <div>
      {items.map((item) => (
        <div key={getKey(item)} data-testid="grid-item">
          {renderItem(item)}
        </div>
      ))}
    </div>
  ),
}));

// No usable localStorage in this test environment; the page keeps its view and card size there.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <CatalogBrowseGrid
            kind="collection"
            kindLabel="Collection"
            entityId={5}
            isLoading={false}
            slug="zelda"
            resyncLabel="Resync Collection"
          />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return userEvent.setup();
}

const cardNames = () => screen.getAllByTestId("grid-item").map((item) => within(item).getByRole("button").getAttribute("aria-label"));

describe("CatalogBrowseGrid", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal("localStorage", memoryStorage());
    resyncStatus = undefined;
    useCollectionAddonsMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has Resync on the left and the shared list controls on the right", () => {
    renderPage();

    const toolbar = screen.getByRole("toolbar");
    for (const name of ["Resync Collection", "Options", "View", "Sort", "Filter"]) {
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("textbox", { name: "Search games" })).toBeInTheDocument();
  });

  it("shows what you're missing from the Options menu, and remembers it for this collection", async () => {
    const user = renderPage();
    expect(cardNames()).toEqual(["Zelda"]);

    await user.click(screen.getByRole("button", { name: "Options" }));
    await user.click(screen.getByRole("menuitem", { name: /Show what I am missing/ }));
    // The menu stays open for another toggle.
    await user.keyboard("{Escape}");

    expect(cardNames()).toEqual(["Zelda", "Zelda II"]);
    expect(window.sessionStorage.getItem("vgt.view.collection.zelda.showMissing")).toBe("true");
  });

  it("includes add-ons from the Options menu as their own section", async () => {
    const user = renderPage();
    expect(document.getElementById("addons")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Options" }));
    await user.click(screen.getByRole("menuitem", { name: /Include Addons/ }));
    // The menu stays open for another toggle.
    await user.keyboard("{Escape}");

    expect(useCollectionAddonsMock).toHaveBeenLastCalledWith("zelda", expect.anything(), true);
    const addons = document.getElementById("addons") as HTMLElement;
    expect(within(addons).getByRole("button", { name: "Master Quest" })).toBeInTheDocument();
    expect(within(document.getElementById("games") as HTMLElement).getByRole("button", { name: "Zelda" })).toBeInTheDocument();
  });

  it("shows a running resync's progress at the top of the page, not in the toolbar", () => {
    resyncStatus = {
      status: "running",
      kind: "collection",
      refSlug: "zelda",
      refName: "Zelda",
      startedAt: null,
      finishedAt: null,
      progress: { current: 2, total: 8 },
      result: null,
      error: null,
    } as CatalogResyncStatus;
    renderPage();

    const progress = screen.getByRole("progressbar");
    expect(within(screen.getByRole("toolbar")).queryByRole("progressbar")).toBeNull();
    // Above the list.
    expect(progress.compareDocumentPosition(screen.getAllByTestId("grid-item")[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("2 / 8 games checked")).toBeInTheDocument();
    expect(within(screen.getByRole("toolbar")).getByRole("button", { name: "Resync Collection" })).toBeDisabled();
  });
});
