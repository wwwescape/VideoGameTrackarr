import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SteamEntry } from "../../api/integrations";
import { createM3Theme } from "../../theme/createM3Theme";
import SteamSyncPage from "../SteamSyncPage";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

let ownedEntries: SteamEntry[] = [];
const syncOwned = vi.fn();
const idleMutation = () => ({ mutateAsync: vi.fn(), isPending: false });
vi.mock("../../hooks/useIntegrations", () => ({
  useSteamEntries: () => ({ data: ownedEntries }),
  useSteamWishlistEntries: () => ({ data: [] }),
  useSyncSteamEntries: () => ({ mutateAsync: syncOwned, isPending: false }),
  useSyncSteamWishlistEntries: () => idleMutation(),
  useIgnoreSteamEntry: () => idleMutation(),
  useIgnoreSteamWishlistEntry: () => idleMutation(),
  useUnlinkSteamEntry: () => idleMutation(),
  useUnlinkSteamWishlistEntry: () => idleMutation(),
}));
vi.mock("../../hooks/useJobs", () => ({
  useJobsList: () => ({ data: [] }),
  useRunJob: () => idleMutation(),
}));
vi.mock("../RelinkSteamEntryDialog", () => ({ default: () => null }));

function entry(steamAppId: number, name: string, status: SteamEntry["status"]): SteamEntry {
  return {
    steamAppId,
    steamName: name,
    steamPlaytimeMinutes: 0,
    steamLastPlayedAt: null,
    status,
    gameId: status === "no_match" ? null : steamAppId,
    gameName: status === "no_match" ? null : name,
    gameSlug: null,
    gameCoverUrl: null,
    vgtPlaytimeMinutes: null,
    parentGameId: null,
  };
}

// 30 syncable entries (more than one 25-row page) plus 2 No catalog match entries.
function makeEntries(syncable: number): SteamEntry[] {
  const list = Array.from({ length: syncable }, (_, i) =>
    entry(1000 + i, `Game ${String(i + 1).padStart(2, "0")}`, "new")
  );
  return [...list, entry(1, "Zzz Unmatched A", "no_match"), entry(2, "Zzz Unmatched B", "no_match")];
}

function renderPage() {
  return render(
    <ThemeProvider theme={createM3Theme("light", "normal")}>
      <MemoryRouter>
        <SteamSyncPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const headerCheckbox = () => within(screen.getAllByRole("rowgroup")[0]).getByRole("checkbox");

// Each test renders a full 25-row MUI table (plus a dialog), which can pass the 5s default
// when the whole suite runs in parallel.
describe("SteamSyncPage select all", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncOwned.mockResolvedValue({ synced: 30, failed: 0, failures: [] });
    ownedEntries = makeEntries(30);
  });

  it("offers to select every syncable entry once the page is selected, and syncs them all", async () => {
    renderPage();

    fireEvent.click(headerCheckbox());
    expect(screen.getByText("All 25 on this page are selected.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select all 30 games" }));
    expect(screen.getByText("All 30 games are selected.")).toBeInTheDocument();
    expect(screen.getByText("30 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sync selected" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Sync 30 entries?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sync" }));

    // Every syncable entry on every page, and none of the No catalog match ones.
    const ids = syncOwned.mock.calls[0][0] as number[];
    expect(ids).toHaveLength(30);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
  });

  it("clears the whole selection from the link or by unticking the header checkbox", async () => {
    renderPage();

    fireEvent.click(headerCheckbox());
    fireEvent.click(screen.getByRole("button", { name: "Select all 30 games" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    fireEvent.click(headerCheckbox());
    fireEvent.click(screen.getByRole("button", { name: "Select all 30 games" }));
    fireEvent.click(headerCheckbox());
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it("doesn't offer it when every syncable entry already fits on one page", async () => {
    ownedEntries = makeEntries(5);
    renderPage();

    fireEvent.click(headerCheckbox());

    expect(screen.getByText("5 selected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
  });
});
