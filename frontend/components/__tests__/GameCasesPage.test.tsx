import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameCase } from "../../api/types";
import GameCasesPage from "../GameCasesPage";

let labOn = true;
let cases: GameCase[] = [];
const mutate = vi.fn();
vi.mock("../../hooks/useLabs", () => ({
  useLabs: () => ({
    data: [{ id: "game_shelf", enabled: labOn }],
    isError: false,
    isFetchedAfterMount: true,
    fetchStatus: "idle",
  }),
  useEnabledLabs: () => new Set(labOn ? ["game_shelf"] : []),
}));
vi.mock("../../hooks/useGameCases", () => ({
  useGameCases: () => ({ data: cases, isLoading: false, isError: false }),
  useSetGameCaseShown: () => ({ mutate, isError: false }),
}));

const gameCase = (overrides: Partial<GameCase>): GameCase => ({
  id: 1,
  platformSlug: "ps5",
  platformName: "PlayStation 5",
  abbreviation: "PS5",
  caseLabel: "Blu-ray case",
  heightMm: 171,
  spineMm: 12,
  caseColor: "#e8e8e8",
  logoBandColor: "#ffffff",
  logoBandHeightPct: 12,
  caseTopMm: 0,
  logoColor: null,
  logoLineColor: null,
  logo: null,
  titleBandColor: "#f5f5f5",
  titleTextColor: "#111111",
  shown: true,
  physicalGames: 51,
  logoUrl: null,
  ...overrides,
});

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/settings/game-cases", element: <GameCasesPage /> },
      { path: "/settings/labs", element: <div>Labs page</div> },
    ],
    { initialEntries: ["/settings/game-cases"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("Settings → Game Cases", () => {
  beforeEach(() => {
    labOn = true;
    cases = [
      gameCase({}),
      gameCase({
        id: 2,
        platformSlug: "switch",
        platformName: "Nintendo Switch",
        abbreviation: "Switch",
        caseLabel: "Nintendo Switch case",
        heightMm: 170,
        spineMm: 10.5,
        shown: false,
        physicalGames: 1,
      }),
    ];
    mutate.mockClear();
  });

  it("lists each case platform with its case, size, games and a preview", () => {
    renderPage();
    expect(screen.getByText("2 platforms")).toBeInTheDocument();
    expect(screen.getByText("Blu-ray case · 171 × 12 mm · 51 physical games")).toBeInTheDocument();
    expect(
      screen.getByText("Nintendo Switch case · 170 × 10.5 mm · 1 physical game")
    ).toBeInTheDocument();
    const [ps5Spine] = screen.getAllByTestId("case-spine");
    expect(within(ps5Spine).getByTestId("logo-band")).toHaveTextContent("PS5");
  });

  it("shows each platform's Show on shelf switch, and flips it", async () => {
    renderPage();
    expect(screen.getByRole("switch", { name: "Show PlayStation 5 on the shelf" })).toBeChecked();
    const nintendo = screen.getByRole("switch", { name: "Show Nintendo Switch on the shelf" });
    expect(nintendo).not.toBeChecked();

    await userEvent.click(nintendo);
    expect(mutate).toHaveBeenCalledWith({ id: 2, shown: true });
  });

  it("sends you to Labs while the Game Shelf lab is off", () => {
    labOn = false;
    const router = renderPage();
    expect(router.state.location.pathname).toBe("/settings/labs");
  });
});
