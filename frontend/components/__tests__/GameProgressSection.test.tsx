import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import type { GameProgress, PlaySession } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GameProgressSection from "../GameProgressSection";

const undoToast = vi.fn();
let progress: GameProgress[] = [];
let sessions: PlaySession[] = [];

vi.mock("../../hooks/useProgress", () => ({
  useGameProgressList: () => ({ data: progress }),
  useCreateGameProgress: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateGameProgress: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteGameProgress: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../hooks/usePlaySessions", () => ({
  usePlaySessions: () => ({ data: sessions }),
  useCreatePlaySession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePlaySession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePlaySession: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../UndoToast", () => ({ showUndoToast: (...args: unknown[]) => undoToast(...args) }));
vi.mock("../ProgressDialog", () => ({
  default: ({ open, editing }: { open: boolean; editing: GameProgress | null }) =>
    open ? <div role="dialog">{editing ? `Edit ${editing.platformName}` : "New progress"}</div> : null,
}));
vi.mock("../PlaySessionDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog">Session</div> : null),
}));

const row = (overrides: Partial<GameProgress>): GameProgress => ({
  id: 1,
  gameId: 7,
  platformId: 1,
  platformName: "PlayStation 5",
  playStatus: "playing",
  playtimeMinutes: 90,
  review: null,
  startedAt: null,
  completedAt: null,
  lastPlayedAt: "2026-10-20",
  ...overrides,
});

function renderSection() {
  render(
    <ThemeProvider theme={createVgtTheme("dark", "normal", "#7c4dff")}>
      <GameProgressSection gameId={7} libraryItems={[]} platforms={[]} playStatus="playing" />
    </ThemeProvider>
  );
  return userEvent.setup();
}

const section = (id: string) => document.getElementById(id) as HTMLElement;

describe("GameProgressSection", () => {
  it("sums up progress across platforms, then lists each platform", () => {
    progress = [row({}), row({ id: 2, platformId: 2, platformName: "PC", playStatus: "completed", playtimeMinutes: 30, lastPlayedAt: "2026-09-01" })];
    sessions = [];
    renderSection();

    const progressSection = section("progress");
    expect(within(progressSection).getByText("Playing", { selector: "div" })).toBeInTheDocument();
    expect(within(progressSection).getByText("2h 0m")).toBeInTheDocument();
    // Your rating is per game now (Your Rating), not per platform.
    expect(within(progressSection).queryByText(/\/10/)).toBeNull();
    const ps5 = within(progressSection).getByRole("button", { name: "PlayStation 5" });
    expect(within(ps5).getByText(/1h 30m · last played/)).toBeInTheDocument();
    expect(within(progressSection).getByRole("button", { name: "PC" })).toHaveTextContent("Completed");
    expect(within(section("play-sessions")).getByText("No sessions logged yet.")).toBeInTheDocument();
  });

  it("opens a platform's progress and removes one with an undo", async () => {
    progress = [row({}), row({ id: 2, platformName: "PC" })];
    sessions = [];
    const user = renderSection();

    await user.click(screen.getByRole("button", { name: "PlayStation 5" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Edit PlayStation 5");

    await user.click(within(screen.getByRole("button", { name: "PC" })).getByRole("button", { name: "Remove" }));
    expect(undoToast).toHaveBeenCalledWith("Progress removed", expect.any(Function), 5000);
    expect(screen.queryByRole("button", { name: "PC" })).toBeNull();
  });

  it("lists play sessions and logs a new one", async () => {
    progress = [];
    sessions = [{ id: 5, gameId: 7, platformId: 1, platformName: "PlayStation 5", startedAt: "2026-10-20T18:00:00", endedAt: null, durationMinutes: 75, notes: "Boss fight" }];
    const user = renderSection();

    const sessionsSection = section("play-sessions");
    expect(within(sessionsSection).getByText("1h 15m")).toBeInTheDocument();
    expect(within(sessionsSection).getByText("Boss fight")).toBeInTheDocument();

    await user.click(within(sessionsSection).getByRole("button", { name: "Log session" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Session");
  });
});
