import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogInstallers } from "../../api/integrations";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GogInstallersSection from "../GogInstallersSection";

let installers: GogInstallers | undefined;
let installersError = false;
const queueDownload = vi.fn();
const fileLink = vi.fn();
vi.mock("../../hooks/useIntegrations", () => ({
  useGogInstallers: () => ({ data: installers, isError: installersError }),
  useQueueGogInstallerDownload: () => ({ mutateAsync: queueDownload, isPending: false }),
  useGogInstallerFileLink: () => ({ mutateAsync: fileLink, isPending: false }),
}));

function makeInstallers(): GogInstallers {
  return {
    gameId: 1,
    gogProductId: 1207658695,
    groups: [
      {
        productId: 1207658695,
        title: "The Witcher 3",
        installers: [
          {
            id: "installer_windows_en",
            os: "windows",
            language: "en",
            version: "1.32",
            totalSize: 123456789,
            files: [
              {
                id: "en1installer0",
                size: 123456789,
                downloadState: "not_downloaded",
                downloadedBytes: 0,
                downloadError: null,
              },
            ],
          },
        ],
      },
      {
        productId: 1234567890,
        title: "Hearts of Stone",
        installers: [
          {
            id: "installer_windows_en",
            os: "windows",
            language: "en",
            version: "1.0",
            totalSize: 987654,
            files: [
              {
                id: "en1installer0",
                size: 987654,
                downloadState: "completed",
                downloadedBytes: 987654,
                downloadError: null,
              },
            ],
          },
        ],
      },
    ],
  };
}

function renderSection(hasGogItem = true) {
  return render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <GogInstallersSection gameId={1} hasGogItem={hasGogItem} />
    </ThemeProvider>
  );
}

describe("GogInstallersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installers = makeInstallers();
    installersError = false;
    queueDownload.mockResolvedValue({ fileId: "en1installer0", status: "queued" });
    fileLink.mockResolvedValue("/api/integrations/gog/games/1/installers/en1installer0/file/token/setup.exe");
  });

  it("shows both groups with a NAS download button and a device download button", () => {
    renderSection();

    expect(screen.getByText("GOG Installers")).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3")).toBeInTheDocument();
    expect(screen.getByText("Hearts of Stone")).toBeInTheDocument();
    expect(screen.getByText("windows · en · 1.32 · 117.7 MB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cache Download" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("queues a NAS download when Cache Download is clicked", async () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Cache Download" }));

    await waitFor(() =>
      expect(queueDownload).toHaveBeenCalledWith({
        installerId: "installer_windows_en",
        fileId: "en1installer0",
      })
    );
  });

  it("opens the tokenized file link when Download is clicked", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(fileLink).toHaveBeenCalledWith({ gameId: 1, fileId: "en1installer0" }));
    expect(open).toHaveBeenCalledWith(
      "/api/integrations/gog/games/1/installers/en1installer0/file/token/setup.exe",
      "_blank",
      "noopener,noreferrer"
    );
    open.mockRestore();
  });

  it("shows a progress bar while a file is downloading on the NAS", () => {
    installers = makeInstallers();
    installers.groups[0].installers[0].files[0] = {
      id: "en1installer0",
      size: 123456789,
      downloadState: "downloading",
      downloadedBytes: 61728394,
      downloadError: null,
    };
    renderSection();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Downloading… 58.9 MB of 117.7 MB")).toBeInTheDocument();
  });

  it("shows Retry with the error when a download failed", async () => {
    installers = makeInstallers();
    installers.groups[0].installers[0].files[0] = {
      id: "en1installer0",
      size: 123456789,
      downloadState: "failed",
      downloadedBytes: 0,
      downloadError: "Downloaded 10 bytes, expected 123456789",
    };
    renderSection();

    expect(screen.getByText("Downloaded 10 bytes, expected 123456789")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(queueDownload).toHaveBeenCalled());
  });

  it("renders nothing without a GOG library item", () => {
    const { container } = renderSection(false);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the installers request fails", () => {
    installersError = true;
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when GOG has no installers for the game", () => {
    installers = { gameId: 1, gogProductId: 1207658695, groups: [] };
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });
});
