import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSortOption, GameSummary } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GameCard, { GameCardHoverAction } from "../GameCard";
import { categoryLabel, GameCoverGrid, GameOverviewRows, GameTable } from "../GameListViews";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const game = (id: number, name: string, overrides: Partial<GameSummary> = {}): GameSummary =>
  ({
    id,
    uuid: `uuid-${id}`,
    igdbId: id,
    name,
    slug: name.toLowerCase(),
    coverUrl: null,
    category: "main_game",
    firstReleaseDate: null,
    owned: true,
    wishlisted: false,
    playStatus: null,
    rating: null,
    isOnSale: false,
    autoDiscovered: false,
    libraryPlatforms: [],
    playable: false,
    ...overrides,
  }) as GameSummary;

const renderWithTheme = (ui: React.ReactElement) =>
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );

describe("Games list views", () => {
  beforeEach(() => vi.stubGlobal("ResizeObserver", ResizeObserverStub));

  it("offers the A–Z rail only while sorted by name, with letters that have no games disabled", () => {
    const games = [game(1, "Celeste"), game(2, "Hades"), game(3, "1080° Snowboarding")];
    const { rerender } = renderWithTheme(
      <GameCoverGrid games={games} cardSize={170} showRail renderCard={(g) => <div>{g.name}</div>} />
    );

    const rail = screen.getByRole("navigation", { name: "Jump to letter" });
    expect(within(rail).getByRole("button", { name: "Jump to C" })).toBeEnabled();
    expect(within(rail).getByRole("button", { name: "Jump to #" })).toBeEnabled();
    expect(within(rail).getByRole("button", { name: "Jump to Z" })).toBeDisabled();

    rerender(
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <GameCoverGrid games={games} cardSize={170} showRail={false} renderCard={(g) => <div>{g.name}</div>} />
        </MemoryRouter>
      </ThemeProvider>
    );
    expect(screen.queryByRole("navigation", { name: "Jump to letter" })).not.toBeInTheDocument();
  });

  it("opens a table row's game from the keyboard, and toggles it while selecting", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggleSelect = vi.fn();
    const games = [game(1, "Celeste", { rating: 9, libraryPlatforms: ["PC"] })];
    const { rerender } = renderWithTheme(
      <GameTable games={games} onOpen={onOpen} selecting={false} selectedIds={new Set()} onToggleSelect={onToggleSelect} sort="name_asc" onSortChange={vi.fn()} />
    );

    screen.getByRole("row", { name: "Celeste" }).focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith(games[0]);
    expect(screen.getByText("9/10")).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <GameTable games={games} onOpen={onOpen} selecting selectedIds={new Set()} onToggleSelect={onToggleSelect} sort="name_asc" onSortChange={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    );
    await user.click(screen.getByRole("row", { name: "Celeste" }));
    expect(onToggleSelect).toHaveBeenCalledWith(1);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("sorts by a column when its header is clicked, flipping the direction on a second click", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const games = [game(1, "Celeste")];
    const table = (sort: GameSortOption) => (
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <GameTable games={games} onOpen={vi.fn()} selecting={false} selectedIds={new Set()} onToggleSelect={vi.fn()} sort={sort} onSortChange={onSortChange} />
        </MemoryRouter>
      </ThemeProvider>
    );
    const { rerender } = render(table("name_asc"));

    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("button", { name: "Rating" }));
    expect(onSortChange).toHaveBeenLastCalledWith("rating_desc");
    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(onSortChange).toHaveBeenLastCalledWith("library_asc");

    rerender(table("labels_asc"));
    expect(screen.getByRole("columnheader", { name: "Labels" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Name" })).not.toHaveAttribute("aria-sort");
    await user.click(screen.getByRole("button", { name: "Labels" }));
    expect(onSortChange).toHaveBeenLastCalledWith("labels_desc");
  });

  it("shows an overview row's facts and the same chips as the card", () => {
    renderWithTheme(
      <GameOverviewRows
        games={[game(1, "Celeste", { firstReleaseDate: 1516233600, libraryPlatforms: ["Switch"], isOnSale: true, igdbId: null })]}
        onOpen={vi.fn()}
        selecting={false}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
      />
    );

    expect(screen.getByText("2018 · Main Game · Switch")).toBeInTheDocument();
    expect(screen.getByText("On Sale")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("labels categories with the filter's game types, then the add-on types", () => {
    expect(categoryLabel({ category: "remaster" })).toBe("Remaster");
    expect(categoryLabel({ category: "dlc_addon" })).toBe("DLC");
  });
});

describe("Game card hover actions", () => {
  it("shows the shortcuts on the cover without opening the game, and hides them while selecting", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const open = vi.fn();
    const action = <GameCardHoverAction icon={<span />} label="Edit" onClick={onEdit} />;
    const { rerender } = renderWithTheme(
      <GameCard game={game(1, "Celeste")} context="list" contextFunction={open} hoverActions={action} />
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <GameCard game={game(1, "Celeste")} context="list" contextFunction={open} hoverActions={action} selectable />
        </MemoryRouter>
      </ThemeProvider>
    );
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("opens the game from the keyboard", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    renderWithTheme(<GameCard game={game(1, "Celeste")} context="list" contextFunction={open} />);

    screen.getByRole("button", { name: "Celeste" }).focus();
    await user.keyboard("{Enter}");
    expect(open).toHaveBeenCalledOnce();
  });
});
