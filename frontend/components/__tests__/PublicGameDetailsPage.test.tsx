import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicGameDetail } from "../../api/types";
import { createM3Theme } from "../../theme/createM3Theme";
import PublicGameDetailsPage from "../PublicGameDetailsPage";

const getPublicGame = vi.fn();
vi.mock("../../api/public", () => ({
  getPublicGame: (...args: unknown[]) => getPublicGame(...args),
}));

const game: PublicGameDetail = {
  id: 42,
  igdbId: 7346,
  name: "Breath of the Wild",
  coverUrl: null,
  category: "standalone_expansion",
  firstReleaseDate: 1488499200,
  summary: "Step into a world of discovery.",
  storyline: null,
  igdbUrl: "https://www.igdb.com/games/botw",
  edition: null,
  rating: null,
  owned: true,
  wishlisted: false,
  parentGameId: null,
  parentGameName: null,
  parentGameSlug: null,
  parentGameUuid: null,
  displayParentGameId: 7,
  displayParentGameName: "Zelda Original",
  displayParentGameSlug: "zelda-original",
  displayParentGameUuid: "u-7",
  externalParentName: null,
  externalParentIgdbUrl: null,
  genres: [{ id: 31, name: "Adventure", slug: "adventure" }],
  companies: [],
  franchises: [{ id: 596, name: "The Legend of Zelda", slug: "the-legend-of-zelda" }],
  collections: [{ id: 12, name: "Zelda Collection", slug: "zelda-collection" }],
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
};

function renderPage(path = "/public/tok/games/42") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={createM3Theme("light", "normal")}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/public/:token/games" element={<div>Public games list</div>} />
            <Route path="/public/:token/games/:gameId" element={<PublicGameDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe("PublicGameDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only the About section, with no private sections or private links", async () => {
    getPublicGame.mockResolvedValue(game);
    renderPage();

    expect(await screen.findByText("Step into a world of discovery.")).toBeInTheDocument();
    expect(getPublicGame).toHaveBeenCalledWith("tok", 42);
    for (const heading of ["Tags", "Your Library", "Addons", "Progress", "Notes"]) {
      expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
    }
    // Series/Collection pages are private, so their chips are plain labels here.
    expect(screen.getByText("Series: The Legend of Zelda")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Series:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Collection:/ })).not.toBeInTheDocument();
    // The display parent links to its public page, not the private /game/... route.
    expect(screen.getByRole("link", { name: "Zelda Original" })).toHaveAttribute(
      "href",
      "/public/tok/games/7"
    );
  });

  it("goes back to the public games list", async () => {
    getPublicGame.mockResolvedValue(game);
    renderPage();

    await userEvent.click(await screen.findByRole("link", { name: "Back to Games" }));

    expect(await screen.findByText("Public games list")).toBeInTheDocument();
  });

  it("shows Game not found for a 404", async () => {
    getPublicGame.mockRejectedValue(
      new AxiosError("Not found", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      })
    );
    renderPage();

    expect(await screen.findByText("Game not found")).toBeInTheDocument();
  });
});
