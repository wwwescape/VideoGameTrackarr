import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogDownload, GogDownloads } from "../../api/integrations";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GogDownloadsPanel from "../GogDownloadsPanel";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

const save = vi.fn();
vi.mock("../../utils/gogDownloads", () => ({ saveGogDownloadToDevice: (id: number) => save(id) }));

let downloads: GogDownloads | undefined;
const retry = vi.fn();
const remove = vi.fn();
vi.mock("../../hooks/useIntegrations", () => ({
  useGogDownloads: () => ({ data: downloads }),
  useRetryGogDownload: () => ({ mutateAsync: retry, isPending: false }),
  useDeleteGogDownload: () => ({ mutateAsync: remove, isPending: false }),
}));

const row = (
  id: number,
  status: GogDownload["status"],
  overrides: Partial<GogDownload> = {}
): GogDownload => ({
  id,
  gameId: 7,
  gameName: "The Witcher 3",
  gameSlug: "the-witcher-3",
  productId: 1207664663,
  installerId: "en1installer0",
  fileId: `file${id}`,
  filename: `setup-${id}.exe`,
  status,
  totalSize: 4 * 1024 * 1024,
  downloadedBytes: status === "completed" ? 4 * 1024 * 1024 : 0,
  error: null,
  ...overrides,
});

function renderPanel() {
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter>
        <GogDownloadsPanel />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const rowFor = (filename: string) =>
  screen.getByText(new RegExp(filename)).closest("div")!.parentElement as HTMLElement;

describe("GogDownloadsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloads = {
      downloads: [
        row(1, "completed"),
        row(2, "downloading", { downloadedBytes: 1024 * 1024 }),
        row(3, "failed", { error: "Connection reset" }),
      ],
      bytesOnDisk: 4 * 1024 * 1024,
    };
  });

  it("stays hidden while nothing has been downloaded", () => {
    downloads = { downloads: [], bytesOnDisk: 0 };
    renderPanel();

    expect(screen.queryByText("Installers on this server")).not.toBeInTheDocument();
  });

  it("lists every download with its state, progress and the space used", () => {
    renderPanel();

    expect(screen.getByText("Installers on this server")).toBeInTheDocument();
    expect(screen.getByText("4.0 MB used")).toBeInTheDocument();
    expect(screen.getByText("On the server")).toBeInTheDocument();
    expect(screen.getByText("Downloading…")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Download progress" })).toHaveAttribute(
      "aria-valuenow",
      "25"
    );
    expect(screen.getByText(/Connection reset/)).toBeInTheDocument();
  });

  it("saves a finished file and retries a failed one", async () => {
    renderPanel();

    fireEvent.click(within(rowFor("setup-1.exe")).getByRole("button", { name: "Save to device" }));
    fireEvent.click(within(rowFor("setup-3.exe")).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(1));
    expect(retry).toHaveBeenCalledWith(3);
  });

  it("cancels a running download after confirming", async () => {
    renderPanel();

    fireEvent.click(within(rowFor("setup-2.exe")).getByRole("button", { name: "Cancel download" }));
    expect(screen.getByText("Cancel this download?")).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel download" })
    );

    await waitFor(() => expect(remove).toHaveBeenCalledWith(2));
  });

  it("deletes a finished file from the server after confirming", async () => {
    renderPanel();

    fireEvent.click(
      within(rowFor("setup-1.exe")).getByRole("button", { name: "Delete from server" })
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete from server" })
    );

    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
  });
});
