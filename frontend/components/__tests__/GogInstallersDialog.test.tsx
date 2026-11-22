import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogInstallerPart, GogInstallers } from "../../api/integrations";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GogInstallersDialog from "../GogInstallersDialog";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

const save = vi.fn();
vi.mock("../../utils/gogDownloads", () => ({ saveGogDownloadToDevice: (id: number) => save(id) }));

let installers: { data?: GogInstallers; isLoading: boolean; error: unknown } = {
  isLoading: false,
  error: null,
};
const download = vi.fn();
vi.mock("../../hooks/useIntegrations", () => ({
  useGogInstallers: () => installers,
  useDownloadGogInstaller: () => ({ mutateAsync: download, isPending: false }),
}));

const part = (id: string, overrides: Partial<GogInstallerPart> = {}): GogInstallerPart => ({
  id,
  size: 1024 * 1024,
  downloadId: null,
  state: "not_downloaded",
  downloadedBytes: 0,
  error: null,
  filename: null,
  ...overrides,
});

function listing(parts: GogInstallerPart[]): GogInstallers {
  return {
    gameId: 7,
    groups: [
      {
        productId: 1207664663,
        title: "The Witcher 3",
        installers: [
          {
            id: "en1installer0",
            os: "windows",
            language: "en",
            version: "4.04",
            totalSize: 2 * 1024 * 1024,
            files: parts,
          },
        ],
      },
      {
        productId: 1640424747,
        title: "Blood and Wine",
        installers: [
          {
            id: "en1installer0",
            os: "linux",
            language: "en",
            version: null,
            totalSize: 1024,
            files: [part("dlc")],
          },
        ],
      },
    ],
  };
}

function renderDialog() {
  render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <GogInstallersDialog open gameId={7} gameName="The Witcher 3" onClose={() => {}} />
    </ThemeProvider>
  );
}

describe("GogInstallersDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installers = { data: listing([part("a"), part("b")]), isLoading: false, error: null };
  });

  it("lists the base game's and DLC installers by OS, language and size", () => {
    renderDialog();

    expect(screen.getByText("Offline installers — The Witcher 3")).toBeInTheDocument();
    expect(screen.getByText("Blood and Wine")).toBeInTheDocument();
    expect(screen.getByText("Windows")).toBeInTheDocument();
    expect(screen.getByText("Linux")).toBeInTheDocument();
    expect(screen.getByText("4.04 · 2.0 MB · 2 files")).toBeInTheDocument();
  });

  it("downloads a whole installer to the server with one button", async () => {
    renderDialog();

    fireEvent.click(screen.getAllByRole("button", { name: "Download to server" })[0]);

    await waitFor(() =>
      expect(download).toHaveBeenCalledWith({ productId: 1207664663, installerId: "en1installer0" })
    );
  });

  it("shows progress while parts download, and each part's state", () => {
    installers = {
      data: listing([
        part("a", { state: "downloading", downloadId: 1, downloadedBytes: 512 * 1024 }),
        part("b", { state: "queued", downloadId: 2 }),
      ]),
      isLoading: false,
      error: null,
    };
    renderDialog();

    expect(screen.getByRole("progressbar", { name: "Download progress" })).toHaveAttribute(
      "aria-valuenow",
      "25"
    );
    expect(screen.getByText("Downloading…")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download to server" })).toHaveLength(1);
  });

  it("saves each finished part to the device", async () => {
    installers = {
      data: listing([
        part("a", { state: "completed", downloadId: 11, filename: "setup.exe" }),
        part("b", { state: "completed", downloadId: 12, filename: "setup-1.bin" }),
      ]),
      isLoading: false,
      error: null,
    };
    renderDialog();

    const row = screen.getByText(/setup-1\.bin/).parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Save to device" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(12));
  });

  it("offers Retry when a part failed", () => {
    installers = {
      data: listing([
        part("a", { state: "failed", downloadId: 1, error: "Connection reset" }),
        part("b"),
      ]),
      isLoading: false,
      error: null,
    };
    renderDialog();

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText(/Connection reset/)).toBeInTheDocument();
  });

  it("explains when the game has no matched GOG copy", () => {
    installers = {
      isLoading: false,
      error: new AxiosError("nope", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    };
    renderDialog();

    expect(screen.getByText(/only for games in your collection as a GOG copy/)).toBeInTheDocument();
  });
});
