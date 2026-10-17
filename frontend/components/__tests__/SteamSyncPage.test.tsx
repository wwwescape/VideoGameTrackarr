import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SteamEntry, SteamWishlistEntry } from "../../api/integrations";
import { createM3Theme } from "../../theme/createM3Theme";
import SteamSyncPage from "../SteamSyncPage";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

let ownedEntries: SteamEntry[] = [];
let wishlistEntries: SteamWishlistEntry[] = [];
const syncOwned = vi.fn();
const ignoreOwnedBulk = vi.fn();
const ignoreWishlistBulk = vi.fn();
const unignoreOwned = vi.fn();
const unignoreWishlist = vi.fn();
const idleMutation = () => ({ mutateAsync: vi.fn(), isPending: false });
vi.mock("../../hooks/useIntegrations", () => ({
  useSteamEntries: () => ({ data: ownedEntries }),
  useSteamWishlistEntries: () => ({ data: wishlistEntries }),
  useSyncSteamEntries: () => ({ mutateAsync: syncOwned, isPending: false }),
  useSyncSteamWishlistEntries: () => idleMutation(),
  useIgnoreSteamEntry: () => idleMutation(),
  useIgnoreSteamWishlistEntry: () => idleMutation(),
  useIgnoreSteamEntries: () => ({ mutateAsync: ignoreOwnedBulk, isPending: false }),
  useIgnoreSteamWishlistEntries: () => ({ mutateAsync: ignoreWishlistBulk, isPending: false }),
  useUnignoreSteamEntry: () => ({ mutateAsync: unignoreOwned, isPending: false }),
  useUnignoreSteamWishlistEntry: () => ({ mutateAsync: unignoreWishlist, isPending: false }),
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
function wishlistEntry(
  steamAppId: number,
  name: string,
  status: SteamWishlistEntry["status"]
): SteamWishlistEntry {
  return {
    steamAppId,
    steamName: name,
    wishlistAddedAt: null,
    status,
    gameId: status === "no_match" ? null : steamAppId,
    gameName: status === "no_match" ? null : name,
    gameSlug: null,
    gameCoverUrl: null,
    parentGameId: null,
  };
}

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
    wishlistEntries = [];
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

// 26 up-to-date entries sort first ("Aaa …"), filling all of page 1, then 5 syncable ones.
function makeMostlySyncedEntries(): SteamEntry[] {
  const synced = Array.from({ length: 26 }, (_, i) =>
    entry(2000 + i, `Aaa Synced ${String(i + 1).padStart(2, "0")}`, "up_to_date")
  );
  const syncable = Array.from({ length: 5 }, (_, i) => entry(3000 + i, `Game ${i + 1}`, "new"));
  return [...synced, ...syncable];
}

const hideSyncedSwitch = () => screen.getByLabelText("Hide synced");

describe("SteamSyncPage on pages with nothing to sync, and Hide synced", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    ownedEntries = makeMostlySyncedEntries();
    wishlistEntries = [];
  });

  it("offers Select all from a page that has nothing syncable on it", () => {
    renderPage();

    expect(headerCheckbox()).toBeDisabled();
    expect(screen.getByText("Nothing to sync on this page.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select all 5 games" }));

    expect(screen.getByText("5 selected")).toBeInTheDocument();
    expect(screen.getByText("All 5 games are selected.")).toBeInTheDocument();
  });

  it("hides up-to-date, already-wishlisted and ignored rows but keeps No catalog match", () => {
    ownedEntries = [
      ...makeMostlySyncedEntries(),
      entry(4000, "Ignored Game", "ignored"),
      entry(4001, "Unmatched Tool", "no_match"),
    ];
    renderPage();

    fireEvent.click(hideSyncedSwitch());

    expect(screen.queryByText("Aaa Synced 01")).not.toBeInTheDocument();
    expect(screen.queryByText("Ignored Game")).not.toBeInTheDocument();
    expect(screen.getByText("Game 1")).toBeInTheDocument();
    expect(screen.getByText("Unmatched Tool")).toBeInTheDocument();
    expect(screen.getByText("1–6 of 6")).toBeInTheDocument();
    expect(headerCheckbox()).toBeEnabled();
  });

  it("keeps a synced parent visible while one of its DLC still needs syncing", () => {
    ownedEntries = [
      entry(5000, "Base Game", "up_to_date"),
      { ...entry(5001, "Base Game DLC", "new"), parentGameId: 5000 },
      entry(5002, "Other Synced Game", "up_to_date"),
    ];
    renderPage();

    fireEvent.click(hideSyncedSwitch());

    expect(screen.getByText("Base Game")).toBeInTheDocument();
    expect(screen.queryByText("Other Synced Game")).not.toBeInTheDocument();
  });

  it("shows an all-synced message, and remembers the switch for the session", () => {
    ownedEntries = [entry(6000, "Done Game", "up_to_date")];
    const { unmount } = renderPage();

    fireEvent.click(hideSyncedSwitch());
    expect(
      screen.getByText("Everything is synced. Turn off Hide synced to see every entry.")
    ).toBeInTheDocument();
    unmount();

    renderPage();
    expect(hideSyncedSwitch()).toBeChecked();
  });
});

describe("SteamSyncPage Ignore selected and Un-ignore", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    ownedEntries = [];
    wishlistEntries = [];
  });

  it("ignores the selected owned and wishlist entries after confirming", async () => {
    ownedEntries = [entry(100, "Owned New", "new"), entry(101, "Owned Done", "up_to_date")];
    wishlistEntries = [wishlistEntry(200, "Wished New", "new")];
    ignoreOwnedBulk.mockResolvedValue({ ignored: 1, failed: 0, failures: [] });
    ignoreWishlistBulk.mockResolvedValue({ ignored: 1, failed: 0, failures: [] });
    renderPage();

    fireEvent.click(headerCheckbox());
    fireEvent.click(screen.getByRole("button", { name: "Ignore selected" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ignore 2 entries?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ignore" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ignored 2 entries.", expect.anything()));
    expect(ignoreOwnedBulk).toHaveBeenCalledWith([100]);
    expect(ignoreWishlistBulk).toHaveBeenCalledWith([200]);
  });

  it("shows Un-ignore instead of Ignore on ignored rows and calls the right endpoint per source", async () => {
    ownedEntries = [entry(100, "Owned Ignored", "ignored")];
    wishlistEntries = [wishlistEntry(200, "Wished Ignored", "ignored"), wishlistEntry(201, "Wished New", "new")];
    unignoreOwned.mockResolvedValue(entry(100, "Owned Ignored", "new"));
    unignoreWishlist.mockResolvedValue(wishlistEntry(200, "Wished Ignored", "new"));
    renderPage();

    expect(screen.getAllByRole("button", { name: "Un-ignore" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Ignore" })).toHaveLength(1);

    const ownedRow = screen.getByText("Owned Ignored").closest("tr") as HTMLElement;
    fireEvent.click(within(ownedRow).getByRole("button", { name: "Un-ignore" }));
    const wishlistRow = screen.getByText("Wished Ignored").closest("tr") as HTMLElement;
    fireEvent.click(within(wishlistRow).getByRole("button", { name: "Un-ignore" }));

    await waitFor(() => expect(unignoreWishlist).toHaveBeenCalledWith(200));
    expect(unignoreOwned).toHaveBeenCalledWith(100);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("hints to run Import when an un-ignored entry has no catalog match", async () => {
    ownedEntries = [{ ...entry(100, "Delisted", "ignored"), gameId: null, gameName: null }];
    unignoreOwned.mockResolvedValue(entry(100, "Delisted", "no_match"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Un-ignore" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        "Un-ignored. Run Import to try matching it to IGDB again.",
        expect.anything()
      )
    );
  });
});
