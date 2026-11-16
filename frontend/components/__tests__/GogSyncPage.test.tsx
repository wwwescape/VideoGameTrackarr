import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogEntry } from "../../api/integrations";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GogSyncPage from "../GogSyncPage";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

let gogEntries: GogEntry[] = [];
let jobsList: import("../../api/types").JobSummary[] = [];
const syncGog = vi.fn();
const ignoreGogBulk = vi.fn();
const unignoreGog = vi.fn();
const idleMutation = () => ({ mutateAsync: vi.fn(), isPending: false });
vi.mock("../../hooks/useIntegrations", () => ({
  useGogEntries: () => ({ data: gogEntries }),
  useSyncGogEntries: () => ({ mutateAsync: syncGog, isPending: false }),
  useIgnoreGogEntry: () => idleMutation(),
  useIgnoreGogEntries: () => ({ mutateAsync: ignoreGogBulk, isPending: false }),
  useUnignoreGogEntry: () => ({ mutateAsync: unignoreGog, isPending: false }),
  useUnlinkGogEntry: () => idleMutation(),
}));
vi.mock("../../hooks/useJobs", () => ({
  useJobsList: () => ({ data: jobsList }),
  useRunJob: () => idleMutation(),
}));
vi.mock("../RelinkGogEntryDialog", () => ({ default: () => null }));

function entry(productId: number, name: string, status: GogEntry["status"]): GogEntry {
  return {
    gogProductId: productId,
    gogName: name,
    status,
    gameId: status === "no_match" ? null : productId,
    gameName: status === "no_match" ? null : name,
    gameSlug: null,
    gameCoverUrl: null,
    parentGameId: null,
  };
}

// 30 syncable entries (more than one 25-row page) plus 2 No catalog match entries.
function makeEntries(syncable: number): GogEntry[] {
  const list = Array.from({ length: syncable }, (_, i) =>
    entry(1000 + i, `Game ${String(i + 1).padStart(2, "0")}`, "new")
  );
  return [...list, entry(1, "Zzz Unmatched A", "no_match"), entry(2, "Zzz Unmatched B", "no_match")];
}

function renderPage() {
  return render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter>
        <GogSyncPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const headerCheckbox = () => within(screen.getAllByRole("rowgroup")[0]).getByRole("checkbox");

// Each test renders a full 25-row MUI table (plus a dialog), which can pass the 5s default
// when the whole suite runs in parallel.
describe("GogSyncPage select all", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncGog.mockResolvedValue({ synced: 30, failed: 0, failures: [] });
    gogEntries = makeEntries(30);
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
    const ids = syncGog.mock.calls[0][0] as number[];
    expect(ids).toHaveLength(30);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
  });

  it("doesn't offer it when every syncable entry already fits on one page", async () => {
    gogEntries = makeEntries(5);
    renderPage();

    fireEvent.click(headerCheckbox());

    expect(screen.getByText("5 selected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
  });
});

// 26 up-to-date entries sort first ("Aaa …"), filling all of page 1, then 5 syncable ones.
function makeMostlySyncedEntries(): GogEntry[] {
  const synced = Array.from({ length: 26 }, (_, i) =>
    entry(2000 + i, `Aaa Synced ${String(i + 1).padStart(2, "0")}`, "up_to_date")
  );
  const syncable = Array.from({ length: 5 }, (_, i) => entry(3000 + i, `Game ${i + 1}`, "new"));
  return [...synced, ...syncable];
}

const hideSyncedSwitch = () => screen.getByLabelText("Hide synced");

describe("GogSyncPage Hide synced", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    gogEntries = makeMostlySyncedEntries();
  });

  it("hides up-to-date and ignored rows but keeps No catalog match", () => {
    gogEntries = [
      ...makeMostlySyncedEntries(),
      entry(4000, "Ignored Game", "ignored"),
      entry(4001, "Unmatched Tool", "no_match"),
    ];
    renderPage();

    // Hide synced is on by default
    expect(hideSyncedSwitch()).toBeChecked();
    expect(screen.queryByText("Aaa Synced 01")).not.toBeInTheDocument();
    expect(screen.queryByText("Ignored Game")).not.toBeInTheDocument();
    expect(screen.getByText("Game 1")).toBeInTheDocument();
    expect(screen.getByText("Unmatched Tool")).toBeInTheDocument();
    expect(screen.getByText("1–6 of 6")).toBeInTheDocument();
    expect(headerCheckbox()).toBeEnabled();
  });

  it("keeps a synced parent visible while one of its DLC still needs syncing", () => {
    gogEntries = [
      entry(5000, "Base Game", "up_to_date"),
      { ...entry(5001, "Base Game DLC", "new"), parentGameId: 5000 },
      entry(5002, "Other Synced Game", "up_to_date"),
    ];
    renderPage();

    // Hide synced is on by default
    expect(screen.getByText("Base Game")).toBeInTheDocument();
    expect(screen.queryByText("Other Synced Game")).not.toBeInTheDocument();
  });

  it("shows an all-synced message, and remembers the switch for the session", () => {
    gogEntries = [entry(6000, "Done Game", "up_to_date")];
    const { unmount } = renderPage();

    // Hide synced is on by default, so the message shows immediately
    expect(hideSyncedSwitch()).toBeChecked();
    expect(
      screen.getByText("Everything is synced. Turn off Hide synced to see every entry.")
    ).toBeInTheDocument();
    unmount();

    renderPage();
    expect(hideSyncedSwitch()).toBeChecked();
  });
});

describe("GogSyncPage Ignore selected and Un-ignore", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    gogEntries = [];
  });

  it("ignores the selected entries after confirming", async () => {
    gogEntries = [entry(100, "Owned New", "new"), entry(101, "Owned Done", "up_to_date")];
    ignoreGogBulk.mockResolvedValue({ ignored: 1, failed: 0, failures: [] });
    renderPage();

    fireEvent.click(headerCheckbox());
    fireEvent.click(screen.getByRole("button", { name: "Ignore selected" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ignore 1 entry?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ignore" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ignored 1 entry.", expect.anything()));
    expect(ignoreGogBulk).toHaveBeenCalledWith([100]);
  });

  it("shows Un-ignore instead of Ignore on ignored rows", async () => {
    gogEntries = [entry(100, "Owned Ignored", "ignored"), entry(101, "Owned New", "new")];
    unignoreGog.mockResolvedValue(entry(100, "Owned Ignored", "new"));
    renderPage();

    // Hide synced is on by default — turn it off to see the ignored row
    fireEvent.click(hideSyncedSwitch());

    expect(screen.getAllByRole("button", { name: "Unignore" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Ignore" })).toHaveLength(1);

    const ignoredRow = screen.getByText("Owned Ignored").closest("tr") as HTMLElement;
    fireEvent.click(within(ignoredRow).getByRole("button", { name: "Unignore" }));

    await waitFor(() => expect(unignoreGog).toHaveBeenCalledWith(100));
  });

  it("shows a toast when un-ignoring an entry that still has no catalog match", async () => {
    gogEntries = [entry(100, "Owned Ignored", "ignored")];
    unignoreGog.mockResolvedValue(entry(100, "Owned Ignored", "no_match"));
    renderPage();

    // Hide synced is on by default — turn it off to see the ignored row
    fireEvent.click(hideSyncedSwitch());

    fireEvent.click(screen.getByRole("button", { name: "Unignore" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        "Un-ignored. Run Import to try matching it to IGDB again.",
        expect.anything()
      )
    );
  });
});

describe("GogSyncPage import progress", { timeout: 20_000 }, () => {
  const runningJob = (progress: { current: number; total: number } | null) => ({
    id: "gog_import",
    run: {
      status: "running" as const,
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      progress,
    },
    schedule: { enabled: false, cronExpression: null, nextRunAt: null, timezone: "UTC" },
    lastRun: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    gogEntries = [];
  });

  it("shows the progress bar and counts under the import button while importing", () => {
    jobsList = [runningJob({ current: 42, total: 100 })];
    renderPage();

    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("42 of 100")).toBeInTheDocument();
  });

  it("shows an indeterminate bar when the job reports no progress yet", () => {
    jobsList = [runningJob(null)];
    renderPage();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("42 of 100")).not.toBeInTheDocument();
  });
});
