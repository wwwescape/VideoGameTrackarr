import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameAboutData } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import { StoreRegionProvider } from "../../theme/StoreRegionProvider";
import { useGameStoreLinks } from "../GameStoreLinks";

// The hero renders these as chips; a plain list of links is enough to check the URLs.
const Links = ({ game }: { game: GameAboutData }) => (
  <>
    {useGameStoreLinks(game).map((link) => (
      <a key={link.key} href={link.href} title={link.title}>
        {link.label}
      </a>
    ))}
  </>
);

const game: GameAboutData = {
  name: "Indiana Jones and the Great Circle",
  category: "main_game",
  igdbId: 1,
  igdbUrl: null,
  firstReleaseDate: null,
  summary: null,
  storyline: null,
  edition: null,
  rating: null,
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
  genres: [],
  companies: [],
  franchises: [],
  collections: [],
  platforms: [],
  screenshotUrls: [],
  artworkUrls: [],
  videos: [],
  releaseDates: [],
  steamStoreUrl: "https://store.steampowered.com/app/2677660",
  xboxStoreUrl: "https://www.xbox.com/en-us/games/store/indiana-jones-and-the-great-circle/9N8FQ28Z6QX3",
  playstationStoreUrl: "https://store.playstation.com/en-us/concept/10012238",
  nintendoStoreUrl: null,
  epicGamesStoreUrl: null,
  gogStoreUrl: null,
};

function renderSection() {
  return render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter>
        <StoreRegionProvider>
          <Links game={game} />
        </StoreRegionProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const linkHref = (title: string) => screen.getByTitle(title).getAttribute("href");

// This test environment (Node 26 + jsdom) has no usable localStorage, so give the provider
// a small in-memory one.
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

describe("GameStoreLinks", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("points PlayStation and Xbox links at the chosen region's store, leaving Steam alone", () => {
    window.localStorage.setItem("vgt.storeRegion", "IN");
    renderSection();

    expect(linkHref("View on PlayStation Store")).toBe("https://store.playstation.com/en-in/concept/10012238");
    expect(linkHref("View on Xbox")).toBe(
      "https://www.xbox.com/en-IN/games/store/indiana-jones-and-the-great-circle/9N8FQ28Z6QX3"
    );
    expect(linkHref("View on Steam")).toBe("https://store.steampowered.com/app/2677660");
  });

  it("lists only the links the game has, IGDB first", () => {
    window.localStorage.setItem("vgt.storeRegion", "off");
    render(
      <StoreRegionProvider>
        <Links game={{ ...game, igdbUrl: "https://www.igdb.com/games/x", xboxStoreUrl: null }} />
      </StoreRegionProvider>
    );

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["IGDB", "Steam", "PlayStation"]);
  });

  it("keeps IGDB's links when store links are set not to change", () => {
    window.localStorage.setItem("vgt.storeRegion", "off");
    renderSection();

    expect(linkHref("View on PlayStation Store")).toBe("https://store.playstation.com/en-us/concept/10012238");
  });
});
