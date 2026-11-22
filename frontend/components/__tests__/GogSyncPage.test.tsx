import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogEntry, GogStatus, GogWishlistEntry } from "../../api/integrations";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GogSyncPage from "../GogSyncPage";

vi.mock("../../hooks/useLabs", () => ({
  useLabs: () => ({ data: [], isError: false }),
  useEnabledLabs: () => new Set(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

let entries: GogEntry[] = [];
let wishlistEntries: GogWishlistEntry[] = [];
let gogStatus: GogStatus = {
  connected: true,
  username: "geralt",
  loginUrl: "https://auth.gog.com/auth",
};
const sync = vi.fn();
const syncWishlist = vi.fn();
const unignoreWishlist = vi.fn();
const ignoreBulk = vi.fn();
const unignore = vi.fn();
const runJob = vi.fn();
const idleMutation = () => ({ mutateAsync: vi.fn(), isPending: false });
vi.mock("../../hooks/useIntegrations", () => ({
  useGogStatus: () => ({ data: gogStatus }),
  useGogEntries: () => ({ data: entries }),
  useGogWishlistEntries: () => ({ data: wishlistEntries }),
  useSyncGogWishlistEntries: () => ({ mutateAsync: syncWishlist, isPending: false }),
  useIgnoreGogWishlistEntry: () => idleMutation(),
  useIgnoreGogWishlistEntries: () => idleMutation(),
  useUnignoreGogWishlistEntry: () => ({ mutateAsync: unignoreWishlist, isPending: false }),
  useUnlinkGogWishlistEntry: () => idleMutation(),
  useSyncGogEntries: () => ({ mutateAsync: sync, isPending: false }),
  useIgnoreGogEntry: () => idleMutation(),
  useIgnoreGogEntries: () => ({ mutateAsync: ignoreBulk, isPending: false }),
  useUnignoreGogEntry: () => ({ mutateAsync: unignore, isPending: false }),
  useUnlinkGogEntry: () => idleMutation(),
}));
vi.mock("../../hooks/useJobs", () => ({
  useJobsList: () => ({ data: [] }),
  useRunJob: () => ({ mutateAsync: runJob, isPending: false }),
}));
vi.mock("../RelinkGogEntryDialog", () => ({ default: () => null }));
vi.mock("../GogDownloadsPanel", () => ({ default: () => <div>Downloads panel</div> }));
vi.mock("../GogInstallersDialog", () => ({
  default: ({ gameName }: { gameName: string }) => (
    <div role="dialog">Installers for {gameName}</div>
  ),
}));

function entry(
  gogProductId: number,
  name: string,
  status: GogEntry["status"],
  parentGameId: number | null = null
): GogEntry {
  return {
    gogProductId,
    gogName: name,
    status,
    gameId: status === "no_match" ? null : gogProductId,
    gameName: status === "no_match" ? null : name,
    gameSlug: null,
    gameCoverUrl: null,
    parentGameId,
  };
}

function wish(
  gogProductId: number,
  name: string,
  status: GogWishlistEntry["status"],
  parentGameId: number | null = null
): GogWishlistEntry {
  return {
    ...entry(gogProductId, name, "new", parentGameId),
    status,
    ...(status === "no_match" ? { gameId: null, gameName: null } : {}),
  };
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <GogSyncPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const headerCheckbox = () => within(screen.getAllByRole("rowgroup")[0]).getByRole("checkbox");

describe("GogSyncPage", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    gogStatus = { connected: true, username: "geralt", loginUrl: "https://auth.gog.com/auth" };
    sync.mockResolvedValue({ synced: 1, failed: 0, failures: [] });
    ignoreBulk.mockResolvedValue({ ignored: 1, failed: 0, failures: [] });
    entries = [];
    wishlistEntries = [];
    syncWishlist.mockResolvedValue({ synced: 1, failed: 0, failures: [] });
  });

  it("has no playtime columns: Name, GOG Status, VGT Status and Actions", () => {
    entries = [entry(1, "The Witcher 3", "new")];
    renderPage();

    const head = within(screen.getAllByRole("rowgroup")[0]);
    expect(head.getByText("Name")).toBeInTheDocument();
    expect(head.getByText("GOG Status")).toBeInTheDocument();
    expect(head.getByText("VGT Status")).toBeInTheDocument();
    expect(head.getByText("Actions")).toBeInTheDocument();
    expect(screen.queryByText(/Playtime/)).not.toBeInTheDocument();
    expect(screen.queryByText("Steam Status")).not.toBeInTheDocument();
  });

  it("points to Integrations and disables Import while GOG isn't connected", () => {
    gogStatus = { connected: false, username: null, loginUrl: "https://auth.gog.com/auth" };
    renderPage();

    expect(screen.getByRole("link", { name: "Settings → Integrations" })).toHaveAttribute(
      "href",
      "/settings/integrations"
    );
    expect(screen.getByRole("button", { name: "Run Import" })).toBeDisabled();
  });

  it("runs the GOG import", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Run Import" }));

    await waitFor(() => expect(runJob).toHaveBeenCalledWith("gog_import"));
  });

  it("shows each status, and only New rows can be selected", () => {
    entries = [
      entry(1, "New Game", "new"),
      entry(2, "Synced Game", "up_to_date"),
      entry(3, "Unmatched Game", "no_match"),
      entry(4, "Ignored Game", "ignored"),
    ];
    renderPage();

    for (const label of ["New", "Up to date", "No catalog match", "Ignored"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("checkbox", { name: "New Game" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Synced Game" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Unmatched Game" })).toBeDisabled();
  });

  it("syncs one row after confirming, as an owned GOG copy", async () => {
    entries = [entry(1, "The Witcher 3", "new")];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    expect(
      screen.getByText('This will add "The Witcher 3" to your library (PC, Digital, GOG).')
    ).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sync" }));

    await waitFor(() => expect(sync).toHaveBeenCalledWith([1]));
    expect(toast.success).toHaveBeenCalled();
  });

  it("bulk-syncs the selection and mentions the DLC that comes along", async () => {
    entries = [
      entry(1, "Base Game", "new"),
      entry(2, "Expansion", "new", 1),
      entry(3, "Other Game", "new"),
    ];
    sync.mockResolvedValue({ synced: 2, failed: 0, failures: [] });
    renderPage();

    fireEvent.click(headerCheckbox());
    fireEvent.click(screen.getByRole("button", { name: "Sync selected" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/This will also sync 1 DLC\./)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sync" }));
    await waitFor(() => expect(sync).toHaveBeenCalledWith(expect.arrayContaining([1, 2, 3])));
  });

  it("nests DLC under its base game behind a toggle", () => {
    entries = [entry(1, "Base Game", "up_to_date"), entry(2, "Expansion", "new", 1)];
    renderPage();

    expect(screen.queryByText("Expansion")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show DLC" }));
    expect(screen.getByText("Expansion")).toBeInTheDocument();
  });

  it("hides synced and ignored rows but keeps No catalog match", () => {
    entries = [
      entry(1, "New Game", "new"),
      entry(2, "Synced Game", "up_to_date"),
      entry(3, "Unmatched Game", "no_match"),
      entry(4, "Ignored Game", "ignored"),
    ];
    renderPage();

    fireEvent.click(screen.getByLabelText("Hide synced"));

    expect(screen.getByText("New Game")).toBeInTheDocument();
    expect(screen.getByText("Unmatched Game")).toBeInTheDocument();
    expect(screen.queryByText("Synced Game")).not.toBeInTheDocument();
    expect(screen.queryByText("Ignored Game")).not.toBeInTheDocument();
  });

  it("ignores the selection after confirming", async () => {
    entries = [entry(1, "New Game", "new")];
    renderPage();

    fireEvent.click(screen.getByRole("checkbox", { name: "New Game" }));
    fireEvent.click(screen.getByRole("button", { name: "Ignore selected" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ignore" }));

    await waitFor(() => expect(ignoreBulk).toHaveBeenCalledWith([1]));
  });

  it("hints to run Import when an un-ignored entry has no catalog match", async () => {
    entries = [entry(4, "Ignored Game", "ignored")];
    unignore.mockResolvedValue(entry(4, "Ignored Game", "no_match"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Un-ignore" }));

    await waitFor(() => expect(unignore).toHaveBeenCalledWith(4));
    expect(toast.info).toHaveBeenCalled();
  });

  it("offers Add as custom game only for unmatched rows", () => {
    entries = [entry(1, "New Game", "new"), entry(3, "Unmatched Game", "no_match")];
    renderPage();

    expect(screen.getAllByRole("button", { name: "Add as custom game" })).toHaveLength(1);
  });
  it("lists wishlist rows next to owned ones, each with its GOG status", () => {
    entries = [entry(1, "Owned Game", "up_to_date")];
    wishlistEntries = [
      wish(2, "Wanted Game", "new"),
      wish(3, "Tracked Wish", "already_wishlisted"),
    ];
    renderPage();

    expect(screen.getByText("Owned")).toBeInTheDocument();
    expect(screen.getAllByText("Wishlisted")).toHaveLength(2);
    expect(screen.getByText("Already wishlisted")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Wanted Game" })).toBeEnabled();
  });

  it("syncs a wishlist row to the VGT wishlist after confirming", async () => {
    wishlistEntries = [wish(2, "Wanted Game", "new")];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    expect(
      screen.getByText('This will add "Wanted Game" to your Wishlist (PC, Digital, GOG).')
    ).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sync" }));

    await waitFor(() => expect(syncWishlist).toHaveBeenCalledWith([2]));
    expect(sync).not.toHaveBeenCalled();
  });

  it("bulk-syncs owned and wishlist rows through their own endpoints", async () => {
    entries = [entry(1, "Owned Game", "new")];
    wishlistEntries = [wish(2, "Wanted Game", "new")];
    renderPage();

    fireEvent.click(headerCheckbox());
    fireEvent.click(screen.getByRole("button", { name: "Sync selected" }));
    expect(
      screen.getByText(
        "This will add 1 new game to your library, 1 game to your wishlist, straight from GOG."
      )
    ).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sync" }));

    await waitFor(() => expect(sync).toHaveBeenCalledWith([1]));
    expect(syncWishlist).toHaveBeenCalledWith([2]);
  });

  it("nests a wishlisted DLC under an owned base game", () => {
    entries = [entry(1, "Base Game", "up_to_date")];
    wishlistEntries = [wish(2, "Wanted DLC", "new", 1)];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Show DLC" }));

    expect(screen.getByText("Wanted DLC")).toBeInTheDocument();
  });

  it("un-ignores a wishlist row through the wishlist endpoint", async () => {
    wishlistEntries = [wish(4, "Ignored Wish", "ignored")];
    unignoreWishlist.mockResolvedValue(wish(4, "Ignored Wish", "new"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Un-ignore" }));

    await waitFor(() => expect(unignoreWishlist).toHaveBeenCalledWith(4));
    expect(unignore).not.toHaveBeenCalled();
  });
  it("opens offline installers from a synced owned row only", () => {
    entries = [entry(1, "Synced Game", "up_to_date"), entry(2, "New Game", "new")];
    wishlistEntries = [wish(3, "Wanted", "already_wishlisted")];
    renderPage();

    const buttons = screen.getAllByRole("button", { name: "Offline installers" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);

    expect(screen.getByRole("dialog")).toHaveTextContent("Installers for Synced Game");
    expect(screen.getByText("Downloads panel")).toBeInTheDocument();
  });
});
