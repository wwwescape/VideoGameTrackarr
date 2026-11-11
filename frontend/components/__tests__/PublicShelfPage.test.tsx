import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicGameShelf } from "../../api/types";
import { shelfPlatform } from "../../test/shelfFixtures";
import { createVgtTheme } from "../../theme/createVgtTheme";
import PublicShelfPage from "../PublicShelfPage";

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

let shelf: PublicGameShelf;
let labOn = true;
const usePublicShelfMock = vi.fn((..._args: unknown[]) => ({ data: shelf, isLoading: false }));
vi.mock("../../hooks/usePublic", () => ({
  usePublicShelf: (...args: unknown[]) => usePublicShelfMock(...args),
  usePublicLabEnabled: () => ({ enabled: labOn, isLoading: false }),
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/public/:token/shelf", element: <PublicShelfPage /> },
      { path: "/public/:token/games", element: <div>Shared games</div> },
      { path: "/public/:token/games/:gameId", element: <div>Shared game</div> },
    ],
    { initialEntries: ["/public/tok/shelf"] }
  );
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
  return { router, user: userEvent.setup() };
}

describe("Public Game Shelf", () => {
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");

  beforeEach(() => {
    labOn = true;
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 1000,
    });
    shelf = {
      cases: [
        { gameId: 7, name: "Astro Bot", platformId: 1 },
        { gameId: 8, name: "Bayonetta 3", platformId: 2 },
      ],
      platforms: [
        shelfPlatform(1, "PlayStation 5", 171, 12),
        shelfPlatform(2, "Nintendo Switch", 170, 10.5),
      ],
    };
    usePublicShelfMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth);
  });

  it("shows the shelf read-only, platforms mixed, with no dividers", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Game Shelf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Astro Bot on PlayStation 5" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bayonetta 3 on Nintendo Switch" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(usePublicShelfMock).toHaveBeenCalledWith("tok", undefined, "name_asc");
  });

  it("opens the shared game page from a case", async () => {
    const { router, user } = renderPage();
    await user.click(screen.getByRole("button", { name: "Astro Bot on PlayStation 5" }));
    expect(router.state.location.pathname).toBe("/public/tok/games/7");
  });

  it("offers the scale and only the public sorts", async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByRole("slider", { name: "Shelf scale" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Sort" }));
    const labels = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(labels.some((label) => label?.includes("Rating"))).toBe(false);
    expect(labels.some((label) => label?.includes("Library"))).toBe(false);
  });

  it("says so when the shelf is empty", () => {
    shelf = { cases: [], platforms: [] };
    renderPage();
    expect(screen.getByText("No games on this shelf.")).toBeInTheDocument();
  });

  it("goes to the Games tab while the owner has the lab off", () => {
    labOn = false;
    const { router } = renderPage();
    expect(router.state.location.pathname).toBe("/public/tok/games");
    expect(usePublicShelfMock).not.toHaveBeenCalled();
  });
});
