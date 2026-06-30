import { render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import GameCard, { type GameCardGame } from "../GameCard";

const baseGame: GameCardGame = {
  name: "Hollow Knight",
  firstReleaseDate: 1_456_704_000,
  coverUrl: null,
  category: "main_game",
};

// GameCard reads M3-specific theme roles (theme.palette.m3, theme.m3Shape) that only
// exist once wrapped in the app's real createM3Theme — the default MUI theme used by
// render() otherwise doesn't have them, which is what every production render goes
// through (see ColorModeProvider.tsx).
const theme = createM3Theme("light", "normal");
function renderWithTheme(ui: React.ReactElement): RenderResult {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("GameCard", () => {
  it("shows a 'No cover' placeholder when there's no cover image", () => {
    renderWithTheme(<GameCard game={baseGame} context="list" contextFunction={vi.fn()} />);

    expect(screen.getByText("No cover")).toBeInTheDocument();
  });

  it("renders the cover image when one exists, with no placeholder text", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.queryByText("No cover")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Hollow Knight/ })).toHaveAttribute(
      "src",
      "https://images.igdb.com/cover.jpg"
    );
  });

  it("shows the wishlist and owned badges in list context", () => {
    const { container } = renderWithTheme(
      <GameCard game={{ ...baseGame, owned: true, wishlisted: true }} context="list" contextFunction={vi.fn()} />
    );

    // Queried by aria-label, not MUI's data-testid - the latter is stripped in production
    // builds (NODE_ENV=production), so a test relying on it would pass here but not
    // reflect what the e2e suite (running against a real production build) actually sees.
    expect(container.querySelector('svg[aria-label="On your wishlist"]')).not.toBeNull();
    expect(container.querySelector('svg[aria-label="In your collection"]')).not.toBeNull();
  });

  it("hides badges while in selectable mode, even if owned/wishlisted", () => {
    const { container } = renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: true, wishlisted: true }}
        context="list"
        contextFunction={vi.fn()}
        selectable
        selected={false}
        onToggleSelect={vi.fn()}
      />
    );

    expect(container.querySelector('svg[aria-label="On your wishlist"]')).toBeNull();
    expect(container.querySelector('svg[aria-label="In your collection"]')).toBeNull();
  });

  it("shows a play status chip when set to something other than 'none'", () => {
    renderWithTheme(<GameCard game={{ ...baseGame, playStatus: "playing" }} context="list" contextFunction={vi.fn()} />);

    expect(screen.getByText("Playing")).toBeInTheDocument();
  });

  it("calls contextFunction when the cover is clicked in list context", async () => {
    const contextFunction = vi.fn();
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" }}
        context="list"
        contextFunction={contextFunction}
      />
    );

    await userEvent.click(screen.getByRole("img", { name: /Hollow Knight/ }));

    expect(contextFunction).toHaveBeenCalledOnce();
  });

  it("in selectable mode, clicking the card toggles selection instead of calling contextFunction", async () => {
    const contextFunction = vi.fn();
    const onToggleSelect = vi.fn();
    renderWithTheme(
      <GameCard
        game={baseGame}
        context="list"
        contextFunction={contextFunction}
        selectable
        selected={false}
        onToggleSelect={onToggleSelect}
      />
    );

    await userEvent.click(screen.getByText("No cover"));

    expect(onToggleSelect).toHaveBeenCalledOnce();
    expect(contextFunction).not.toHaveBeenCalled();
  });

  it("shows the addon type label for non-main_game categories", () => {
    renderWithTheme(<GameCard game={{ ...baseGame, category: "dlc_addon" }} context="addon" contextFunction={vi.fn()} />);

    expect(screen.getByText("DLC")).toBeInTheDocument();
  });
});
