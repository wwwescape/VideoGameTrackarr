import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IgdbGamePreview } from "../../api/types";
import { createM3Theme } from "../../theme/createM3Theme";
import IgdbGamePreviewPage from "../IgdbGamePreviewPage";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const getIgdbGamePreview = vi.fn();
vi.mock("../../api/igdb", () => ({
  getIgdbGamePreview: (...args: unknown[]) => getIgdbGamePreview(...args),
  searchIgdb: vi.fn(),
}));

const importGame = vi.fn();
vi.mock("../../hooks/useGames", () => ({
  useImportGame: () => ({ mutateAsync: importGame, isPending: false }),
}));

const preview: IgdbGamePreview = {
  igdbId: 7346,
  name: "Breath of the Wild",
  slug: "botw",
  coverUrl: null,
  category: "main_game",
  firstReleaseDate: 1488499200,
  summary: "Step into a world of discovery.",
  storyline: null,
  igdbUrl: "https://www.igdb.com/games/botw",
  edition: null,
  rating: null,
  owned: false,
  wishlisted: false,
  isOnSale: false,
  autoDiscovered: false,
  parentGameId: null,
  parentGameName: null,
  parentGameSlug: null,
  parentGameUuid: null,
  displayParentGameId: null,
  displayParentGameName: null,
  displayParentGameSlug: null,
  displayParentGameUuid: null,
  externalParentName: null,
  externalParentIgdbUrl: null,
  genres: [{ id: 31, name: "Adventure", slug: "adventure" }],
  companies: [],
  franchises: [{ id: 596, name: "The Legend of Zelda", slug: "the-legend-of-zelda" }],
  collections: [],
  platforms: [],
  screenshotUrls: [],
  artworkUrls: [],
  videos: [],
  releaseDates: [],
  steamStoreUrl: null,
  xboxStoreUrl: null,
  playstationStoreUrl: null,
  nintendoStoreUrl: null,
  epicGamesStoreUrl: null,
  gogStoreUrl: null,
  localGame: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={createM3Theme("light", "normal")}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/games/add/igdb/7346"]}>
          <Routes>
            <Route path="/games/add/igdb/:igdbId" element={<IgdbGamePreviewPage />} />
            <Route path="/game/:identifier" element={<div>Real game page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe("IgdbGamePreviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the game's details from IGDB, with series as plain text rather than a local link", async () => {
    getIgdbGamePreview.mockResolvedValue(preview);
    renderPage();

    expect(await screen.findByText("Step into a world of discovery.")).toBeInTheDocument();
    expect(getIgdbGamePreview).toHaveBeenCalledWith(7346);
    expect(screen.getByText("Not in your library yet")).toBeInTheDocument();
    expect(screen.getByText("Series: The Legend of Zelda")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Series: The Legend of Zelda/ })
    ).not.toBeInTheDocument();
  });

  it("adds the game and opens its real page", async () => {
    const user = userEvent.setup();
    getIgdbGamePreview.mockResolvedValue(preview);
    importGame.mockResolvedValue({ name: "Breath of the Wild", slug: "botw", uuid: "u-1" });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add Game" }));

    expect(importGame).toHaveBeenCalledWith(7346);
    expect(await screen.findByText("Real game page")).toBeInTheDocument();
  });

  it("redirects straight to the real page when the game is already in the library", async () => {
    getIgdbGamePreview.mockResolvedValue({
      ...preview,
      localGame: { slug: "botw", uuid: "u-1", name: "Breath of the Wild" },
    });
    renderPage();

    expect(await screen.findByText("Real game page")).toBeInTheDocument();
  });
});
