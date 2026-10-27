import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IgdbImportEntry } from "../../api/igdbImport";
import { createVgtTheme } from "../../theme/createVgtTheme";
import IgdbImportPage from "../IgdbImportPage";

let entries: IgdbImportEntry[] = [];
const linkOne = vi.fn();
const linkSelected = vi.fn();
const setIgnored = vi.fn();
const runJob = vi.fn();
const idleJob = (id: string) => ({ data: { id, run: { status: "idle" }, schedule: { enabled: false } } });

vi.mock("../../hooks/useIgdbImport", () => ({
  useIgdbImportEntries: () => ({ data: entries }),
  useJobStatus: (id: string) => idleJob(id),
  useLinkIgdbImportEntry: () => ({ mutateAsync: linkOne, isPending: false }),
  useLinkSelectedIgdbImportEntries: () => ({ mutateAsync: linkSelected, isPending: false }),
  useSetIgdbImportIgnored: () => ({ mutateAsync: setIgnored, isPending: false }),
  useInvalidateAfterLinking: () => vi.fn(),
}));
vi.mock("../../hooks/useJobs", () => ({ useRunJob: () => ({ mutateAsync: runJob }) }));
vi.mock("../LinkToIgdbDialog", () => ({
  default: ({ gameName }: { gameName: string }) => <div role="dialog">Link to IGDB: {gameName}</div>,
}));
vi.mock("../SettingsFrame", () => ({
  default: ({ toolbarEnd, children }: { toolbarEnd: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <div role="toolbar">{toolbarEnd}</div>
      {children}
    </div>
  ),
}));

const entry = (gameId: number, gameName: string, overrides: Partial<IgdbImportEntry> = {}): IgdbImportEntry => ({
  gameId,
  gameUuid: `uuid-${gameId}`,
  gameSlug: null,
  gameName,
  gameCoverUrl: null,
  gameCategory: "main_game",
  gameFirstReleaseDate: null,
  status: "match_found",
  matchIgdbId: 1000 + gameId,
  matchName: gameName,
  matchCoverUrl: null,
  matchFirstReleaseDate: null,
  matchCategory: "main_game",
  exactMatchCount: 1,
  checkedAt: "2026-10-27T10:00:00Z",
  libraryGameName: null,
  queued: false,
  ...overrides,
});

const renderPage = () => {
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter>
        <IgdbImportPage />
      </MemoryRouter>
    </ThemeProvider>
  );
  return userEvent.setup();
};

const row = (name: string) => screen.getByRole("row", { name });

describe("IgdbImportPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    [linkOne, linkSelected, setIgnored, runJob].forEach((fn) => fn.mockReset().mockResolvedValue(2));
    entries = [
      entry(1, "Stage Tour"),
      entry(2, "Test Game", { status: "in_library", libraryGameName: "Test Game" }),
      entry(3, "Doom", { status: "several_matches", matchIgdbId: null, matchName: null, exactMatchCount: 2 }),
      entry(4, "Homebrew", { status: "no_match", matchIgdbId: null, matchName: null, exactMatchCount: 0 }),
      entry(5, "Old One", { status: "ignored", matchIgdbId: null, matchName: null }),
    ];
  });

  it("lists every custom game with its match and status", () => {
    renderPage();

    expect(within(row("Stage Tour")).getByText("Match found")).toBeInTheDocument();
    expect(within(row("Test Game")).getByText("Merges into Test Game")).toBeInTheDocument();
    expect(within(row("Doom")).getByText(/2 IGDB games have this name/)).toBeInTheDocument();
    expect(within(row("Homebrew")).getByText("No IGDB game has this name")).toBeInTheDocument();
    expect(within(row("Old One")).getByText("Ignored")).toBeInTheDocument();
    // Only a game with a match can be linked or selected.
    expect(within(row("Stage Tour")).getByRole("button", { name: "Link" })).toBeInTheDocument();
    expect(within(row("Test Game")).getByRole("button", { name: "Merge" })).toBeInTheDocument();
    expect(within(row("Doom")).queryByRole("button", { name: "Link" })).toBeNull();
    expect(within(row("Doom")).getByRole("checkbox")).toBeDisabled();
  });

  it("links one game, or opens Link to IGDB to choose another", async () => {
    const user = renderPage();

    await user.click(within(row("Stage Tour")).getByRole("button", { name: "Link" }));
    expect(linkOne).toHaveBeenCalledWith(1);

    await user.click(within(row("Doom")).getByRole("button", { name: "Choose another" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Link to IGDB: Doom");
  });

  it("links the selected games after confirming, saying how many merge", async () => {
    const user = renderPage();

    await user.click(screen.getByRole("checkbox", { name: "Select the games with a match on this page" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Link selected" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Link 2 games to IGDB?");
    expect(dialog).toHaveTextContent("1 of them matches a game already in your library and merges into it.");
    await user.click(within(dialog).getByRole("button", { name: "Link" }));
    expect(linkSelected).toHaveBeenCalledWith([1, 2]);
  });

  it("finds matches, ignores and un-ignores, and hides the ignored ones", async () => {
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: "Find matches" }));
    expect(runJob).toHaveBeenCalledWith("igdb_match");

    await user.click(within(row("Homebrew")).getByRole("button", { name: "Ignore" }));
    expect(setIgnored).toHaveBeenCalledWith({ gameIds: [4], ignored: true });
    await user.click(within(row("Old One")).getByRole("button", { name: "Un-ignore" }));
    expect(setIgnored).toHaveBeenLastCalledWith({ gameIds: [5], ignored: false });

    await user.click(screen.getByRole("switch", { name: "Hide ignored" }));
    expect(screen.queryByRole("row", { name: "Old One" })).toBeNull();
  });

  it("sorts by status from its header", async () => {
    const user = renderPage();
    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((tr) => tr.getAttribute("aria-label"));

    await user.click(screen.getByRole("button", { name: "Status" }));

    expect(names()).toEqual(["Stage Tour", "Test Game", "Doom", "Homebrew", "Old One"]);
  });

  it("says when there are no custom games", () => {
    entries = [];
    renderPage();

    expect(screen.getByText(/You have no custom games/)).toBeInTheDocument();
  });
});
