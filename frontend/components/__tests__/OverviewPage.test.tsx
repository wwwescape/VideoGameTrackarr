import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardStats, GameSummary, HardwareStats } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import OverviewPage from "../OverviewPage";

const game = (id: number, name: string): GameSummary =>
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
    playStatus: "playing",
    rating: null,
    isOnSale: false,
    autoDiscovered: false,
    libraryPlatforms: [],
    playable: false,
  }) as Partial<GameSummary> as GameSummary;

let stats: DashboardStats;
let hardwareStats: HardwareStats;
let playing: GameSummary[];
let customGames: GameSummary[];

vi.mock("../../hooks/useDashboard", () => ({
  useDashboardStats: () => ({ data: stats }),
  useReleaseCalendar: () => ({ data: [] }),
}));
vi.mock("../../hooks/useHardwareStats", () => ({ useHardwareStats: () => ({ data: hardwareStats }) }));
vi.mock("../../hooks/useGames", () => ({
  useGames: (filters: { playStatuses?: string[]; sources?: string[] }) => ({
    data: filters.playStatuses ? playing : filters.sources ? customGames : [],
  }),
}));
vi.mock("../../hooks/useInsights", () => ({
  useMissingAddons: () => ({ data: [{}, {}] }),
  useDuplicateLibraryItems: () => ({ data: [] }),
  useAccessoriesWithoutOwnedHardware: () => ({ data: [{}] }),
  useOnSale: () => ({ data: [] }),
}));
vi.mock("../../hooks/useEvents", () => ({ useEvents: () => ({ data: [] }) }));

function renderPage() {
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/games" element={<div>Games list</div>} />
          <Route path="/insights/missing-addons" element={<div>Missing add-ons page</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
  return userEvent.setup();
}

const session = (name: string) => JSON.parse(window.sessionStorage.getItem(`vgt.view.games.${name}`) ?? "null");

describe("OverviewPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    stats = {
      totalOwned: 12,
      totalWishlisted: 4,
      totalTracked: 20,
      totalPlaytimeMinutes: 125,
      averageRating: null,
      playStatusBreakdown: { backlog: 7, playing: 1 },
      platformBreakdown: [],
      genreBreakdown: [],
      recentlyAdded: [game(5, "Celeste")],
      recentlyPlayed: [],
    };
    hardwareStats = {
      ownedConsoles: 2,
      ownedAccessories: 3,
      wishlistHardware: 1,
      manufacturerDistribution: [],
      platformDistribution: [],
      collectionValue: 0,
      recentlyAdded: [],
    };
    playing = [game(1, "Hades")];
    customGames = [game(9, "My Homebrew")];
  });

  it("shows the headline tiles", () => {
    renderPage();

    expect(screen.getByRole("button", { name: /Games owned\s*12/ })).toBeInTheDocument();
    expect(screen.getByText("20 tracked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Hardware owned\s*5/ })).toHaveAttribute("href", "/hardware");
    expect(screen.getByText("2 devices · 3 accessories")).toBeInTheDocument();
    expect(screen.getByText("2h 5m")).toBeInTheDocument();
  });

  it("opens the Games list filtered to owned games, replacing remembered filters", async () => {
    window.sessionStorage.setItem("vgt.view.games.tagIds", JSON.stringify([3]));
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: /Games owned/ }));

    expect(screen.getByText("Games list")).toBeInTheDocument();
    expect(session("ownershipStatuses")).toEqual(["owned"]);
    expect(session("tagIds")).toEqual([]);
  });

  it("shows what you're playing and links the backlog", async () => {
    const user = renderPage();

    const section = document.getElementById("now-playing") as HTMLElement;
    expect(within(section).getByRole("button", { name: "Hades" })).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Backlog · 7" }));

    expect(session("playStatuses")).toEqual(["backlog"]);
  });

  it("shows recently added games", () => {
    renderPage();

    const section = document.getElementById("recently-added") as HTMLElement;
    expect(within(section).getByRole("button", { name: "Celeste" })).toBeInTheDocument();
  });

  it("counts what needs attention and links each to its list", async () => {
    const user = renderPage();

    const section = document.getElementById("needs-attention") as HTMLElement;
    expect(within(section).getByRole("button", { name: /Custom games\s*1/ })).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /Duplicate copies\s*0/ })).toHaveAttribute("href", "/insights/duplicates");
    expect(within(section).getByRole("link", { name: /Accessories without hardware\s*1/ })).toBeInTheDocument();

    await user.click(within(section).getByRole("link", { name: /Missing Addons\s*2/ }));
    expect(screen.getByText("Missing add-ons page")).toBeInTheDocument();
  });

  it("filters Games to custom games from Needs attention", async () => {
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: /Custom games/ }));

    expect(session("sources")).toEqual(["custom"]);
  });

  it("welcomes an empty library", () => {
    stats = { ...stats, totalTracked: 0, totalOwned: 0, totalWishlisted: 0, recentlyAdded: [], playStatusBreakdown: {} };
    hardwareStats = { ...hardwareStats, ownedConsoles: 0, ownedAccessories: 0, wishlistHardware: 0 };
    playing = [];
    renderPage();

    expect(screen.getByText("Welcome to VideoGameTrackarr")).toBeInTheDocument();
    expect(screen.getByText("Nothing marked Playing yet.")).toBeInTheDocument();
  });
});
