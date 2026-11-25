import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Guide } from "../../../api/types";
import GuideReader from "../GuideReader";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const createGuideViewLink = vi.fn();
const createGuideDownloadLink = vi.fn();
vi.mock("../../../api/documents", () => ({
  createDocumentViewLink: (...args: unknown[]) => createGuideViewLink(...args),
  createDocumentDownloadLink: (...args: unknown[]) => createGuideDownloadLink(...args),
}));

const downloadFromUrl = vi.fn();
vi.mock("../../../utils/download", () => ({
  downloadFromUrl: (...args: unknown[]) => downloadFromUrl(...args),
}));

const openGuideInNewTab = vi.fn();
vi.mock("../../../utils/guideLinks", () => ({
  openGuideInNewTab: (...args: unknown[]) => openGuideInNewTab(...args),
  serverDetail: () => undefined,
}));

// The views have their own tests (and pdf.js doesn't run in jsdom): each just says what it got.
vi.mock("../PdfView", () => ({
  default: ({ url, find }: { url: string; find: { query: string } }) => (
    <div>
      PDF view of {url} find:{find.query}
    </div>
  ),
}));
vi.mock("../HtmlView", () => ({
  default: ({ url }: { url: string }) => <div>Page view of {url}</div>,
}));
vi.mock("../TextView", () => ({
  default: ({ url }: { url: string }) => <div>Text view of {url}</div>,
}));
vi.mock("../ImageView", () => ({
  default: ({ url }: { url: string }) => <div>Image view of {url}</div>,
}));

function guide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 1,
    gameId: 5,
    name: "Walkthrough",
    kind: "guide",
    source: "file",
    platformId: null,
    platformName: null,
    copyId: null,
    copyNumber: null,
    url: null,
    domain: null,
    originalFilename: "walkthrough.pdf",
    mediaFormat: "pdf",
    sizeBytes: 100,
    fileMissing: false,
    createdAt: "2026-11-24T10:00:00Z",
    updatedAt: "2026-11-24T10:00:00Z",
    ...overrides,
  };
}

function renderReader(value: Guide) {
  const onClose = vi.fn();
  const onReplace = vi.fn();
  render(
    <GuideReader
      owner={{ type: "game", id: 5 }}
      guide={value}
      onClose={onClose}
      onReplace={onReplace}
    />
  );
  return { user: userEvent.setup(), onClose, onReplace };
}

describe("GuideReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createGuideViewLink.mockResolvedValue("https://app.test/api/guides/1/content/tok/f");
  });

  it.each([
    ["pdf", "PDF view of"],
    ["docx", "Page view of"],
    ["md", "Page view of"],
    ["txt", "Text view of"],
  ] as const)("shows a %s guide in its view, from a fresh view link", async (format, view) => {
    renderReader(guide({ mediaFormat: format }));

    expect(
      await screen.findByText(new RegExp(`${view} https://app.test/api/guides/1/content/tok/f`))
    ).toBeInTheDocument();
    expect(createGuideViewLink).toHaveBeenCalledWith({ type: "game", id: 5 }, 1);
    expect(screen.getByRole("heading", { name: "Walkthrough" })).toBeInTheDocument();
  });

  it("offers Try again when the link can't be had", async () => {
    createGuideViewLink.mockRejectedValueOnce(new Error("offline"));
    const { user } = renderReader(guide({ mediaFormat: "txt" }));

    expect(await screen.findByText("Couldn't open this document.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(/Text view of/)).toBeInTheDocument();
    expect(createGuideViewLink).toHaveBeenCalledTimes(2);
  });

  it("offers Replace for a file that isn't on the server", async () => {
    const missing = guide({ fileMissing: true });
    const { user, onReplace } = renderReader(missing);

    expect(screen.getByText("This file isn't on the server any more.")).toBeInTheDocument();
    expect(createGuideViewLink).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Replace file" }));

    expect(onReplace).toHaveBeenCalledWith(missing);
  });

  it("opens find with Ctrl+F, passes the text on, and Esc closes find before the reader", async () => {
    const { user, onClose } = renderReader(guide());
    await screen.findByText(/PDF view of/);

    await user.keyboard("{Control>}f{/Control}");
    const field = screen.getByRole("textbox", { name: "Find" });
    await user.type(field, "boss");
    expect(await screen.findByText(/find:boss/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Find" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("opens in a new tab and downloads", async () => {
    createGuideDownloadLink.mockResolvedValue("/api/guides/1/content/dl/walkthrough.pdf");
    const { user } = renderReader(guide());

    await user.click(screen.getByRole("button", { name: "Open in new tab" }));
    expect(openGuideInNewTab).toHaveBeenCalledWith(
      { type: "game", id: 5 },
      expect.objectContaining({ id: 1 }),
      expect.any(Function)
    );

    await user.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(downloadFromUrl).toHaveBeenCalled());
  });

  it("closes from its Close button", async () => {
    const { user, onClose } = renderReader(guide());

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("GuideReader with an image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createGuideViewLink.mockResolvedValue(
      "https://app.test/api/hardware-documents/7/content/tok/r.jpg"
    );
  });

  it("shows a hardware document's photo, with find off", async () => {
    render(
      <GuideReader
        owner={{ type: "device", id: 3 }}
        guide={guide({ id: 7, kind: "receipt", mediaFormat: "jpg", originalFilename: "r.jpg" })}
        onClose={vi.fn()}
        onReplace={vi.fn()}
      />
    );
    expect(
      await screen.findByText(
        "Image view of https://app.test/api/hardware-documents/7/content/tok/r.jpg"
      )
    ).toBeInTheDocument();
    expect(createGuideViewLink).toHaveBeenCalledWith({ type: "device", id: 3 }, 7);
    expect(screen.getByRole("button", { name: "Find" })).toBeDisabled();
  });
});
