import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GameAboutData } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import { GameAboutBlock, gameBackdrop, GameHero } from "../GameDetailParts";

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
    igdbRating: 88.61,
    igdbRatingCount: 193,
    igdbCriticRating: 77.67,
    igdbCriticRatingCount: 3,
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
    for (const pill of ["In your collection", "Playing", "On Sale", "IGDB members 8.9", "Critics 7.8", "Switch", "PC"]) {
      expect(screen.getByText(pill)).toBeInTheDocument();
    }
    // IGDB's ratings on its own 10-point scale, with how many each is based on.
    expect(screen.getByTitle("Based on 193 ratings on IGDB")).toHaveTextContent("IGDB members 8.9");
    expect(screen.getByTitle("Based on 3 ratings on IGDB")).toHaveTextContent("Critics 7.8");
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

describe("game hero links", () => {
  it("shows IGDB and the store pages as chips on their own row, opening in a new tab", () => {
    render(
      <ThemeProvider theme={createVgtTheme("dark", "normal", "#7c4dff")}>
        <MemoryRouter>
          <GameHero
            game={about({ igdbUrl: "https://www.igdb.com/games/celeste", steamStoreUrl: "https://store.steampowered.com/app/504230" })}
            status={{ coverUrl: null }}
            crumbs={[]}
          />
        </MemoryRouter>
      </ThemeProvider>
    );

    const igdb = screen.getByRole("link", { name: "IGDB" });
    expect(igdb).toHaveAttribute("href", "https://www.igdb.com/games/celeste");
    expect(igdb).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Steam" })).toHaveAttribute("title", "View on Steam");
    expect(screen.queryByRole("img", { name: /View on/ })).toBeNull();
  });
});

describe("game About", () => {
  const renderAbout = (game: GameAboutData) =>
    render(
      <ThemeProvider theme={createVgtTheme("dark", "normal", "#7c4dff")}>
        <MemoryRouter>
          <GameAboutBlock game={game} />
        </MemoryRouter>
      </ThemeProvider>
    );

  const platformRows = () =>
    [...(screen.getByRole("heading", { name: "Platforms & release dates" }).parentElement as HTMLElement).querySelectorAll("li")].map(
      (row) => row.textContent
    );

  it("shows the platforms and release dates as one card, without the old facts", () => {
    renderAbout(
      about({
        summary: "Climb the mountain.",
        companies: [
          { id: 1, name: "Maddy Makes Games", slug: null, role: "developer", logoUrl: null },
          { id: 2, name: "Porting Co", slug: null, role: "porting", logoUrl: null },
        ],
        platforms: [
          { id: 6, name: "PC (Microsoft Windows)" },
          { id: 130, name: "Nintendo Switch" },
        ] as GameAboutData["platforms"],
        releaseDates: [
          { id: 1, platformName: "PC (Microsoft Windows)", date: 1516838400, human: "Jan 25, 2018", releaseRegion: "worldwide" },
          { id: 2, platformName: "Nintendo Switch", date: 1516838400, human: "Jan 25, 2018", releaseRegion: "europe" },
        ] as GameAboutData["releaseDates"],
      })
    );

    expect(screen.getByText("Climb the mountain.")).toBeInTheDocument();
    expect(platformRows()).toEqual(["Nintendo SwitchJan 25, 2018Europe", "PC (Microsoft Windows)Jan 25, 2018Worldwide"]);
    expect(screen.queryByRole("heading", { name: "Platforms" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Release dates" })).toBeNull();
    expect(screen.queryByText("Porting Co")).toBeNull();
    expect(screen.queryByText("Developed by")).toBeNull();
  });

  it("lists a row per platform by name, its dates earliest first", () => {
    renderAbout(
      about({
        platforms: [
          { id: 48, name: "Sony Playstation 4" },
          { id: 6, name: "PC (Microsoft Windows)" },
          { id: 130, name: "Nintendo Switch" },
        ] as GameAboutData["platforms"],
        releaseDates: [
          { id: 1, platformName: "Sony Playstation 4", date: 100, human: "Sep 30, 2025", releaseRegion: null },
          { id: 2, platformName: "Nintendo Switch", date: 300, human: "Oct 2, 2025", releaseRegion: "europe" },
          { id: 3, platformName: "Nintendo Switch", date: 200, human: "Oct 1, 2025", releaseRegion: "japan" },
          { id: 4, platformName: "PC (Microsoft Windows)", date: 100, human: "Sep 30, 2025", releaseRegion: null },
        ] as GameAboutData["releaseDates"],
      })
    );

    expect(platformRows()).toEqual([
      "Nintendo SwitchOct 1, 2025JapanOct 2, 2025Europe",
      "PC (Microsoft Windows)Sep 30, 2025",
      "Sony Playstation 4Sep 30, 2025",
    ]);
  });

  it("leaves the date blank for a platform with no known release date", () => {
    renderAbout(
      about({
        platforms: [
          { id: 6, name: "PC (Microsoft Windows)" },
          { id: 167, name: "PlayStation 5" },
          { id: 169, name: "Xbox Series X|S" },
        ] as GameAboutData["platforms"],
        releaseDates: [
          { id: 1, platformName: "PC (Microsoft Windows)", date: 1759190400, human: "Sep 30, 2025", releaseRegion: null },
          { id: 2, platformName: "PlayStation 5", date: null, human: "TBD", releaseRegion: null },
        ] as GameAboutData["releaseDates"],
      })
    );

    expect(platformRows()).toEqual(["PC (Microsoft Windows)Sep 30, 2025", "PlayStation 5", "Xbox Series X|S"]);
    expect(screen.queryByText(/TBD/)).toBeNull();
  });

  it("shows the card for a single release, and nothing without platforms or dates", () => {
    const { unmount } = renderAbout(
      about({ releaseDates: [{ id: 1, platformName: "PC", date: 1514764800, human: "2018", releaseRegion: null }] as GameAboutData["releaseDates"] })
    );
    expect(platformRows()).toEqual(["PC2018"]);
    unmount();

    renderAbout(about({}));
    expect(screen.queryByRole("heading", { name: "Platforms & release dates" })).toBeNull();
  });
});
