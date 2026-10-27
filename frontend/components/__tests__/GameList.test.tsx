import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSummary } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import { writeSessionValue } from "../../utils/sessionViewState";
import GameList from "../GameList";

// No usable localStorage in this test environment; the list keeps its view and card size there.
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

// jsdom doesn't implement ResizeObserver, which the covers grid needs to mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const game = (overrides: Partial<GameSummary>): GameSummary =>
  ({
    id: 1,
    uuid: "uuid-1",
    igdbId: 100,
    name: "Hollow Knight",
    slug: "hollow-knight",
    coverUrl: null,
    category: "main_game",
    firstReleaseDate: 1488499200,
    owned: true,
    wishlisted: false,
    playStatus: null,
    rating: null,
    isOnSale: false,
    autoDiscovered: false,
    libraryPlatforms: ["Switch", "PC"],
    playable: false,
    ...overrides,
  }) as GameSummary;

const GAMES = [
  game({}),
  game({ id: 2, uuid: "uuid-2", name: "My Homebrew", slug: null, igdbId: null, libraryPlatforms: [] }),
  game({ id: 3, uuid: "uuid-3", name: "Super Mario Bros.", slug: "smb", playable: true, libraryPlatforms: ["NES"] }),
];

const useGamesMock = vi.fn((..._args: unknown[]) => ({ data: GAMES, isLoading: false, isFetching: false }));
vi.mock("../../hooks/useGames", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
  useDeleteGame: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: [], isSuccess: true }),
  useLibraryPlatforms: () => ({ data: [], isSuccess: true }),
}));
vi.mock("../../hooks/useGenres", () => ({ useGenres: () => ({ data: [], isSuccess: true }) }));
vi.mock("../../hooks/useTags", () => ({
  useTags: () => ({ data: [], isSuccess: true }),
  useCreateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../hooks/useCatalogBrowse", () => ({
  useCollections: () => ({ data: [], isSuccess: true }),
  useFranchises: () => ({ data: [], isSuccess: true }),
}));
vi.mock("../../hooks/useStorefronts", () => ({ useStorefronts: () => ({ data: [] }) }));
vi.mock("../../hooks/useLibrary", () => ({
  useLibraryItems: () => ({ data: [] }),
}));
let labOn = false;
vi.mock("../../hooks/useLabs", () => ({ useEnabledLabs: () => new Set(labOn ? ["screensaver"] : []) }));
const bulkMutate = vi.fn();
vi.mock("../../hooks/useScreensaver", () => ({
  useSetScreensaverExcludedBulk: () => ({ mutate: bulkMutate, isPending: false }),
}));
const showUndoToast = vi.fn();
vi.mock("../UndoToast", () => ({ showUndoToast: (...args: unknown[]) => showUndoToast(...args) }));
// ManageTagsDialog is always mounted; its hooks only need to exist.
vi.mock("../ManageTagsDialog", () => ({ default: () => null }));
vi.mock("../PlayGameDialog", () => ({
  default: ({ gameName }: { gameName: string }) => <div role="dialog">Play {gameName}</div>,
}));

function renderList() {
  const router = createMemoryRouter(
    [
      { path: "/games", element: <GameList /> },
      { path: "*", element: <div>Elsewhere</div> },
    ],
    { initialEntries: ["/games"] }
  );
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
  return { router, user: userEvent.setup() };
}

describe("Games list", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    useGamesMock.mockClear();
    labOn = false;
    bulkMutate.mockReset();
    showUndoToast.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has the toolbar actions, search beside the breadcrumbs and a game count", () => {
    renderList();

    const toolbar = screen.getByRole("toolbar");
    for (const name of ["Add Game", "Select", "Options", "View", "Sort", "Filter"]) {
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("textbox", { name: "Search games" })).toBeInTheDocument();
    expect(screen.getByText("3 games")).toBeInTheDocument();
  });

  it("switches to the Table view, shows each game's platforms and remembers the view", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(screen.getByRole("menuitem", { name: /Table/ }));

    const row = screen.getByRole("row", { name: "Hollow Knight" });
    expect(within(row).getByText("Switch, PC")).toBeInTheDocument();
    expect(localStorage.getItem("vgt.pref.games.view")).toBe(JSON.stringify("table"));
  });

  it("sorts from the Sort menu", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(screen.getByRole("menuitem", { name: "Descending" }));
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "name_desc" }));

    // A new field starts in its own direction (highest rated first), keeping the menu's two parts.
    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(screen.getByRole("menuitem", { name: "Rating" }));
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "rating_desc" }));

    await user.click(screen.getByRole("button", { name: "Sort" }));
    expect(screen.getByRole("menuitem", { name: "Library" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Labels" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Ascending" }));
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "rating_asc" }));
  });

  it("shows active filters as chips that can be removed one by one", async () => {
    window.sessionStorage.setItem("vgt.view.games.playStatuses", JSON.stringify(["backlog", "playing"]));
    const { user } = renderList();

    expect(screen.getByRole("button", { name: "Filter" })).toHaveTextContent("2");
    await user.click(screen.getByLabelText("Remove filter Backlog"));

    expect(screen.queryByLabelText("Remove filter Backlog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Remove filter Playing")).toBeInTheDocument();
  });

  it("opens the Filter dialog without the More tab (sorting lives in the toolbar)", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Filter" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Filters")).toBeInTheDocument();
    expect(within(dialog).queryByRole("tab")).not.toBeInTheDocument();
  });

  it("swaps the toolbar for the selection actions, counting what's picked", async () => {
    const { user } = renderList();

    await user.click(screen.getByRole("button", { name: "Select" }));
    const toolbar = screen.getByRole("toolbar");
    expect(within(toolbar).getByText("0 selected")).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Remove" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /Hollow Knight/ }));
    expect(within(toolbar).getByText("1 selected")).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Remove" })).toBeEnabled();

    await user.click(within(toolbar).getByRole("button", { name: "Done" }));
    expect(within(screen.getByRole("toolbar")).getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("offers Edit on custom games and Play on games with a playable ROM", async () => {
    const { router, user } = renderList();

    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Play Super Mario Bros.");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(router.state.location.pathname).toBe("/game/my-homebrew-uuid-2/edit");
  });
});

describe("Games list — Screensaver lab", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    useGamesMock.mockClear();
    useGamesMock.mockReturnValue({
      data: [GAMES[0], { ...GAMES[1], screensaverExcluded: true }, GAMES[2]],
      isLoading: false,
      isFetching: false,
    });
    labOn = true;
    bulkMutate.mockReset();
    showUndoToast.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useGamesMock.mockReturnValue({ data: GAMES, isLoading: false, isFetching: false });
  });

  it("has no Screensaver button while the lab is off", async () => {
    labOn = false;
    const { user } = renderList();
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("button", { name: "Screensaver" })).not.toBeInTheDocument();
  });

  it("hides the selected games, counting only those it changes, with an exact Undo", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("button", { name: "Select" }));
    const toolbar = screen.getByRole("toolbar");
    expect(within(toolbar).getByRole("button", { name: "Screensaver" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /Hollow Knight/ }));
    await user.click(screen.getByRole("checkbox", { name: /My Homebrew/ }));
    await user.click(within(toolbar).getByRole("button", { name: "Screensaver" }));

    expect(screen.getByRole("menuitem", { name: "Hide from screensaver (1)" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Show in screensaver (1)" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Hide from screensaver (1)" }));

    expect(bulkMutate).toHaveBeenCalledWith({ gameIds: [1], excluded: true }, expect.anything());
    const [, callbacks] = bulkMutate.mock.calls[0] as [unknown, { onSuccess: () => void }];
    callbacks.onSuccess();
    expect(showUndoToast).toHaveBeenCalledWith("1 game hidden from the screensaver", expect.any(Function), 8000);

    const undo = showUndoToast.mock.calls[0][1] as () => void;
    undo();
    expect(bulkMutate).toHaveBeenLastCalledWith({ gameIds: [1], excluded: false }, expect.anything());
    // Still selecting, for another change.
    expect(within(toolbar).getByText("2 selected")).toBeInTheDocument();
  });

  it("drops selected games that leave the list from the selection", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("checkbox", { name: /Hollow Knight/ }));
    await user.click(screen.getByRole("checkbox", { name: /My Homebrew/ }));
    expect(within(screen.getByRole("toolbar")).getByText("2 selected")).toBeInTheDocument();

    // Hollow Knight no longer matches (e.g. the Screensaver filter after hiding it).
    useGamesMock.mockReturnValue({ data: [GAMES[1], GAMES[2]], isLoading: false, isFetching: false });
    // Picking another game re-renders the list with the new results.
    await user.click(screen.getByRole("checkbox", { name: /Super Mario Bros/ }));
    expect(await within(screen.getByRole("toolbar")).findByText("2 selected")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Hollow Knight/ })).not.toBeInTheDocument();
  });

  it("disables a choice that would change nothing", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("checkbox", { name: /Hollow Knight/ }));
    await user.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Screensaver" }));
    expect(screen.getByRole("menuitem", { name: "Show in screensaver (0)" })).toHaveAttribute("aria-disabled", "true");
  });

  it("sends a remembered Screensaver filter only while the lab is on", () => {
    writeSessionValue("games.screensaverFilter", "hidden");
    renderList();
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.objectContaining({ screensaver: "hidden" }));
    expect(screen.getByText("Screensaver: Hidden")).toBeInTheDocument();
  });

  it("ignores a remembered Screensaver filter once the lab is off", () => {
    writeSessionValue("games.screensaverFilter", "hidden");
    labOn = false;
    renderList();
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.not.objectContaining({ screensaver: "hidden" }));
    expect(screen.queryByText("Screensaver: Hidden")).not.toBeInTheDocument();
  });
});

describe("Games list — Include add-ons", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    useGamesMock.mockClear();
    labOn = false;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is off by default", () => {
    renderList();
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.not.objectContaining({ includeAddons: true }));
  });

  it("sends a remembered choice, with a chip that turns it off", async () => {
    writeSessionValue("games.includeAddons", true);
    const { user } = renderList();
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.objectContaining({ includeAddons: true }));

    expect(screen.getByText("Including add-ons")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Remove filter Including add-ons"));
    expect(useGamesMock).toHaveBeenLastCalledWith(expect.not.objectContaining({ includeAddons: true }));
  });
});
