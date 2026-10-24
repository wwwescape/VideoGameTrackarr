import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GameAboutData } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import { gameBackdrop, GameHero } from "../GameDetailParts";

const about = (overrides: Partial<GameAboutData> = {}): GameAboutData =>
  ({
    name: "Celeste",
    category: "main_game",
    igdbId: 1,
    igdbUrl: null,
    firstReleaseDate: 1516233600,
    summary: null,
    storyline: null,
    edition: null,
    rating: 91.4,
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
    genres: [{ id: 1, name: "Platform", slug: null }],
    companies: [{ id: 1, name: "Maddy Makes Games", role: "developer", logoUrl: null }],
    franchises: [{ id: 2, name: "Celeste", slug: "celeste" }],
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
    ...overrides,
  }) as GameAboutData;

describe("game hero backdrop", () => {
  it("prefers IGDB artwork, then the first screenshot, then the cover blurred", () => {
    expect(gameBackdrop(about({ artworkUrls: ["art.jpg"], screenshotUrls: ["shot.jpg"] }), "cover.jpg")).toEqual({
      url: "art.jpg",
      blur: false,
    });
    expect(gameBackdrop(about({ screenshotUrls: ["shot.jpg"] }), "cover.jpg")).toEqual({ url: "shot.jpg", blur: false });
    expect(gameBackdrop(about(), "https://images.igdb.com/cover.jpg")).toEqual({
      url: "https://images.igdb.com/cover.jpg",
      blur: true,
    });
    expect(gameBackdrop(about(), null)).toBeNull();
  });
});

describe("game hero", () => {
  const renderHero = (ui: React.ReactElement) =>
    render(
      <ThemeProvider theme={createVgtTheme("dark", "normal", "#7c4dff")}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    );

  it("shows the name, a subline and the library and catalog pills", () => {
    renderHero(
      <GameHero
        game={about()}
        status={{ coverUrl: null, owned: true, playStatus: "playing", isOnSale: true, copyPlatforms: ["Switch", "PC"] }}
        crumbs={[{ label: "Games", to: "/games" }]}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Celeste" })).toBeInTheDocument();
    expect(screen.getByText("Maddy Makes Games")).toBeInTheDocument();
    for (const pill of ["In your collection", "Playing", "On Sale", "IGDB Rating: 91/100", "Switch", "PC"]) {
      expect(screen.getByText(pill)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /Series: Celeste/ })).toHaveAttribute("href", "/games/series/celeste");
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute("href", "/games");
  });

  it("marks custom games, and doesn't link series pages from an IGDB preview", () => {
    renderHero(<GameHero game={about({ igdbId: null })} status={{ coverUrl: null }} crumbs={[]} preview />);

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Series: Celeste/ })).not.toBeInTheDocument();
    expect(screen.getByText("Series: Celeste")).toBeInTheDocument();
  });
});
