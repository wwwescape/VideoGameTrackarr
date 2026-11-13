import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InsightGameRef, MissingAddonsEntry } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import MissingAddonsSection from "../MissingAddonsSection";

const ref = (id: number, name: string, overrides: Partial<InsightGameRef> = {}): InsightGameRef => ({
  id,
  uuid: `uuid-${id}`,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  coverUrl: null,
  category: "dlc_addon",
  firstReleaseDate: null,
  owned: false,
  wishlisted: false,
  autoDiscovered: false,
  ...overrides,
});

const ENTRIES: MissingAddonsEntry[] = [
  {
    game: ref(1, "Elden Ring", { category: "main_game", owned: true }),
    missingAddons: [ref(11, "Shadow of the Erdtree"), ref(12, "Colosseum", { wishlisted: true })],
  },
  { game: ref(2, "Hades", { category: "main_game", owned: true }), missingAddons: [ref(21, "Soundtrack")] },
];

vi.mock("../../hooks/useInsights", () => ({ useMissingAddons: () => ({ data: ENTRIES }) }));
vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: [], isSuccess: true }),
  useLibraryPlatforms: () => ({ data: [], isSuccess: true }),
}));
vi.mock("../../hooks/useGenres", () => ({ useGenres: () => ({ data: [], isSuccess: true }) }));
vi.mock("../../hooks/useTags", () => ({ useTags: () => ({ data: [], isSuccess: true }) }));
vi.mock("../../hooks/useCatalogBrowse", () => ({
  useCollections: () => ({ data: [], isSuccess: true }),
  useFranchises: () => ({ data: [], isSuccess: true }),
}));
vi.mock("../../hooks/useStorefronts", () => ({ useStorefronts: () => ({ data: [] }) }));
// Render every entry plainly — virtualisation isn't what's under test here.
vi.mock("../VirtualList", () => ({
  default: <T,>({ items, getKey, renderItem }: { items: T[]; getKey: (item: T) => number; renderItem: (item: T) => ReactNode }) => (
    <div>
      {items.map((item) => (
        <div key={getKey(item)}>{renderItem(item)}</div>
      ))}
    </div>
  ),
}));

function renderPage() {
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter>
        <MissingAddonsSection />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("MissingAddonsSection", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("has Options, Sort and Filter but no View, and a game count", () => {
    renderPage();

    const toolbar = screen.getByRole("toolbar");
    for (const name of ["Options", "Sort", "Filter"]) {
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(within(toolbar).queryByRole("button", { name: "View" })).toBeNull();
    expect(screen.getByText("2 games")).toBeInTheDocument();
  });

  it("shows a section per owned game, linked, with its missing add-ons", () => {
    renderPage();

    const section = screen.getByRole("heading", { name: "Elden Ring" }).closest("section") as HTMLElement;
    expect(within(section).getByRole("link", { name: "Open game" })).toHaveAttribute("href", "/game/elden-ring");
    expect(within(section).getByRole("button", { name: "Shadow of the Erdtree" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Colosseum" })).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Soundtrack" })).toBeNull();
  });

  it("narrows each game's add-ons by ownership, dropping games left with none", () => {
    window.sessionStorage.setItem("vgt.view.missingAddons.ownershipStatuses", JSON.stringify(["wishlisted"]));
    renderPage();

    expect(screen.getByRole("button", { name: "Colosseum" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shadow of the Erdtree" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Hades" })).toBeNull();
    expect(screen.getByText("1 game")).toBeInTheDocument();
  });
});
