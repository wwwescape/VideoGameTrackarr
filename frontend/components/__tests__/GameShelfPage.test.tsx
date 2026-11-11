import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameShelf, ShelfCase } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import { shelfPlatform } from "../../test/shelfFixtures";
import GameShelfPage from "../GameShelfPage";

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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const shelfCase = (gameId: number, name: string, platformId: number): ShelfCase => ({
  gameId,
  uuid: `uuid-${gameId}`,
  slug: name.toLowerCase().replace(/ /g, "-"),
  name,
  platformId,
});

let shelf: GameShelf;
let labOn = true;
const useGameShelfMock = vi.fn((..._args: unknown[]) => ({
  data: shelf,
  isLoading: false,
  isFetching: false,
}));
vi.mock("../../hooks/useGames", () => ({
  useGameShelf: (...args: unknown[]) => useGameShelfMock(...args),
}));
vi.mock("../../hooks/useLabs", () => ({
  useLabs: () => ({
    data: [{ id: "game_shelf", enabled: labOn }],
    isError: false,
    isFetchedAfterMount: true,
    fetchStatus: "idle",
  }),
}));
vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: [], isSuccess: true }),
}));
vi.mock("../../hooks/useTags", () => ({
  useTags: () => ({ data: [], isSuccess: true }),
  useCreateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../hooks/useCatalogBrowse", () => ({
  useCollections: () => ({ data: [], isSuccess: true }),
  useFranchises: () => ({ data: [], isSuccess: true }),
}));
vi.mock("../../hooks/useStorefronts", () => ({ useStorefronts: () => ({ data: [] }) }));

function renderShelf() {
  const router = createMemoryRouter(
    [
      { path: "/games/shelf", element: <GameShelfPage /> },
      { path: "/game/:id", element: <div>Game page</div> },
      { path: "/settings/labs", element: <div>Labs page</div> },
    ],
    { initialEntries: ["/games/shelf"] }
  );
  render(
    <ThemeProvider theme={createVgtTheme("dark", "normal", "#7c4dff")}>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
  return { router, user: userEvent.setup() };
}

// hidden: an open menu hides the page behind it from the accessibility tree.
const caseButtons = () => screen.queryAllByRole("button", { name: / on /, hidden: true });

describe("Game Shelf page", () => {
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");

  beforeEach(() => {
    labOn = true;
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    // jsdom has no layout: give the shelf a width to pack rows against.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 1000,
    });
    shelf = {
      cases: [
        shelfCase(1, "Astro Bot", 1),
        shelfCase(2, "Bayonetta 3", 2),
        shelfCase(3, "Celeste", 1),
      ],
      platforms: [
        shelfPlatform(1, "PlayStation 5", 171, 12),
        shelfPlatform(2, "Nintendo Switch", 170, 10.5),
      ],
    };
    useGameShelfMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth);
  });

  it("shows every case in the server's order, platforms mixed, with no dividers", () => {
    renderShelf();

    expect(screen.getByText("3 cases")).toBeInTheDocument();
    expect(caseButtons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Astro Bot on PlayStation 5",
      "Bayonetta 3 on Nintendo Switch",
      "Celeste on PlayStation 5",
    ]);
    expect(screen.queryByRole("button", { name: /^Edit the / })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("draws each case's logo band and title band from its case look", () => {
    renderShelf();
    const spine = screen.getAllByTestId("case-spine")[0];
    expect(spine).toHaveStyle({ backgroundColor: "#111111" });
    expect(within(spine).getByTestId("logo-band")).toHaveStyle({ backgroundColor: "#222222" });
    // No logo file yet: the platform's name in the logo band.
    expect(within(spine).getByTestId("logo-band")).toHaveTextContent("PlayStation 5");
    expect(within(spine).getByTestId("title-band")).toHaveTextContent("Astro Bot");
  });

  it("offers only the scale in Options, Platforms in Sort, and no Ownership or Format filters", async () => {
    const { user } = renderShelf();
    const toolbar = screen.getByRole("toolbar");
    expect(within(toolbar).queryByRole("button", { name: "View" })).not.toBeInTheDocument();

    await user.click(within(toolbar).getByRole("button", { name: "Options" }));
    expect(screen.getByRole("slider", { name: "Shelf scale" })).toHaveValue("0.4");
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    await user.keyboard("{Escape}");

    await user.click(within(toolbar).getByRole("button", { name: "Sort" }));
    const sortMenu = screen.getByRole("menu");
    expect(within(sortMenu).getByRole("menuitem", { name: /Platforms/ })).toBeInTheDocument();
    expect(within(sortMenu).queryByRole("menuitem", { name: /Labels/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(within(toolbar).getByRole("button", { name: "Filter" }));
    expect(screen.queryByLabelText("Ownership")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Formats")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Platforms")).toBeInTheDocument();
  });

  it("opens a game from its case", async () => {
    const { router, user } = renderShelf();
    await user.click(screen.getByRole("button", { name: "Astro Bot on PlayStation 5" }));
    expect(router.state.location.pathname).toBe("/game/astro-bot");
  });

  it("sends the list filters and sort to the server", () => {
    renderShelf();
    expect(useGameShelfMock).toHaveBeenCalledWith(expect.objectContaining({ sort: "name_asc" }));
  });

  it("explains an empty shelf", () => {
    shelf = { cases: [], platforms: [] };
    renderShelf();
    expect(screen.getByText(/No games on your shelf yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Game" })).toHaveAttribute("href", "/games/add");
  });

  it("sends you to Labs while the Game Shelf lab is off", () => {
    labOn = false;
    const { router } = renderShelf();
    expect(router.state.location.pathname).toBe("/settings/labs");
    expect(useGameShelfMock).not.toHaveBeenCalled();
  });
});
