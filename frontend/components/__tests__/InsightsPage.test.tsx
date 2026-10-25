import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVgtTheme } from "../../theme/createVgtTheme";
import InsightsPage from "../InsightsPage";

vi.mock("../../hooks/useDashboard", () => ({
  useDashboardStats: () => ({
    data: {
      totalOwned: 12,
      totalWishlisted: 4,
      totalTracked: 20,
      totalPlaytimeMinutes: 60,
      averageRating: 8.25,
      playStatusBreakdown: { none: 9, completed: 3, playing: 1 },
      platformBreakdown: [
        { name: "PlayStation 5", count: 6 },
        { name: "Retired Console", count: 2 },
      ],
      genreBreakdown: [{ name: "Platformer", count: 5 }],
      recentlyAdded: [],
      recentlyPlayed: [],
    },
  }),
}));
vi.mock("../../hooks/useHardwareStats", () => ({
  useHardwareStats: () => ({
    data: {
      ownedConsoles: 2,
      ownedAccessories: 3,
      wishlistHardware: 1,
      manufacturerDistribution: [{ name: "Sony", count: 4 }],
      platformDistribution: [],
      collectionValue: 0,
      recentlyAdded: [],
    },
  }),
}));
vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: [{ id: 7, name: "PlayStation 5", slug: "ps5", abbreviation: "PS5" }] }),
}));
vi.mock("../../hooks/useInsights", () => ({
  useMissingAddons: () => ({ data: [{}] }),
  useDuplicateLibraryItems: () => ({ data: [] }),
  useAccessoriesWithoutOwnedHardware: () => ({ data: [] }),
  useOnSale: () => ({ data: [{}, {}] }),
}));

function renderPage() {
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter initialEntries={["/insights"]}>
        <Routes>
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/games" element={<div>Games list</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
  return userEvent.setup();
}

const panel = (title: string) => screen.getByRole("heading", { name: title }).parentElement!.parentElement as HTMLElement;

describe("InsightsPage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("shows the headline numbers for games and hardware", () => {
    renderPage();

    const games = document.getElementById("games") as HTMLElement;
    expect(within(games).getByText("8.3")).toBeInTheDocument();
    expect(within(games).getByText("1h")).toBeInTheDocument();
    const hardware = document.getElementById("hardware") as HTMLElement;
    expect(within(hardware).getByRole("link", { name: /Owned consoles\s*2/ })).toBeInTheDocument();
  });

  it("lists play statuses largest first and opens Games filtered to one", async () => {
    const user = renderPage();

    const rows = within(panel("By Play Status")).getAllByRole("listitem").map((row) => row.getAttribute("title"));
    expect(rows).toEqual(["Not started: 9", "Completed: 3", "Playing: 1"]);

    await user.click(within(panel("By Play Status")).getByRole("button", { name: /Completed/ }));
    expect(screen.getByText("Games list")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vgt.view.games.playStatuses")).toBe(JSON.stringify(["completed"]));
  });

  it("links a platform row to Games filtered to it, when the platform is known", async () => {
    const user = renderPage();

    const platforms = panel("By Platform");
    expect(within(platforms).queryByRole("button", { name: /Retired Console/ })).toBeNull();
    await user.click(within(platforms).getByRole("button", { name: /PlayStation 5/ }));

    expect(window.sessionStorage.getItem("vgt.view.games.platformIds")).toBe(JSON.stringify([7]));
  });

  it("shows hardware breakdowns, and says so when one is empty", () => {
    renderPage();

    expect(within(panel("By manufacturer")).getByTitle("Sony: 4")).toBeInTheDocument();
    expect(within(panel("By platform")).getByText("Nothing to show yet.")).toBeInTheDocument();
  });

  it("links each Insights page with its count", () => {
    renderPage();

    const more = document.getElementById("more") as HTMLElement;
    expect(within(more).getByRole("link", { name: /On Sale\s*2/ })).toHaveAttribute("href", "/insights/on-sale");
    expect(within(more).getByRole("link", { name: /Duplicates\s*0/ })).toHaveAttribute("href", "/insights/duplicates");
  });
});
