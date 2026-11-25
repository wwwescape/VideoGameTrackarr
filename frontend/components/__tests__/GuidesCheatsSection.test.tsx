import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Guide } from "../../api/types";
import GuidesCheatsSection from "../GuidesCheatsSection";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const createGuideViewLink = vi.fn();
const createGuideDownloadLink = vi.fn();
vi.mock("../../api/documents", () => ({
  createDocumentViewLink: (...args: unknown[]) => createGuideViewLink(...args),
  createDocumentDownloadLink: (...args: unknown[]) => createGuideDownloadLink(...args),
}));

const downloadFromUrl = vi.fn();
vi.mock("../../utils/download", () => ({
  downloadFromUrl: (...args: unknown[]) => downloadFromUrl(...args),
}));

// The reader has its own tests; here it only says which guide it shows, and can be closed.
vi.mock("../guideReader/GuideReader", () => ({
  default: ({ guide, onClose }: { guide: Guide; onClose: () => void }) => (
    <div role="dialog" aria-label="Reader">
      Reading {guide.name}
      <button onClick={onClose}>Close reader</button>
    </div>
  ),
}));

// The dialog has its own tests.
vi.mock("../DocumentDialog", () => ({
  default: ({ entry, highlightReplace }: { entry?: Guide; highlightReplace?: boolean }) => (
    <div role="dialog">
      {entry ? `Editing ${entry.name}` : "Adding"}
      {highlightReplace ? " (replace)" : ""}
    </div>
  ),
}));

let guides: Guide[] = [];
const deleteGuide = vi.fn();
vi.mock("../../hooks/useDocuments", () => ({
  useDocuments: () => ({ data: guides, isError: false }),
  useDeleteDocument: () => ({ mutateAsync: deleteGuide, isPending: false }),
  useCreateDocumentLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function guide(overrides: Partial<Guide>): Guide {
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
    sizeBytes: 2516582,
    fileMissing: false,
    createdAt: "2026-11-24T10:00:00Z",
    updatedAt: "2026-11-24T10:00:00Z",
    ...overrides,
  };
}

const FILE = guide({ id: 1, platformName: "PlayStation 2" });
const LINK = guide({
  id: 2,
  name: "GameFAQs codes",
  kind: "cheat",
  source: "link",
  url: "https://gamefaqs.gamespot.com/ps2/codes",
  domain: "gamefaqs.gamespot.com",
  originalFilename: null,
  mediaFormat: null,
  sizeBytes: null,
});
const MISSING = guide({ id: 3, name: "Maps", mediaFormat: "md", fileMissing: true });

let currentHash = "";
const HashProbe = () => {
  currentHash = useLocation().hash;
  return null;
};

function renderSection(list: Guide[], initialEntry = "/games/5") {
  guides = list;
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GuidesCheatsSection gameId={5} libraryItems={[]} gamePlatforms={[]} />
      <HashProbe />
    </MemoryRouter>
  );
  return userEvent.setup();
}

function row(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^Open ${name}`) });
}

describe("GuidesCheatsSection", () => {
  const openSpy = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", openSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("says so when there are none", () => {
    renderSection([]);

    expect(screen.getByText("Guides & Cheats")).toBeInTheDocument();
    expect(screen.getByText("No guides, cheats or manuals yet.")).toBeInTheDocument();
  });

  it("shows file, link and missing-file rows with their own details and actions", () => {
    renderSection([FILE, LINK, MISSING]);

    const file = row("Walkthrough");
    expect(within(file).getByRole("img", { name: "Guide" })).toBeInTheDocument();
    expect(within(file).getByText("PDF · 2.4 MB · PlayStation 2")).toBeInTheDocument();
    expect(within(file).getByRole("button", { name: "Download" })).toBeInTheDocument();

    const link = row("GameFAQs codes");
    expect(within(link).getByRole("img", { name: "Cheat" })).toBeInTheDocument();
    expect(within(link).getByText("gamefaqs.gamespot.com")).toBeInTheDocument();
    expect(within(link).getByRole("button", { name: "Open in new tab" })).toBeInTheDocument();
    expect(within(link).queryByRole("button", { name: "Download" })).toBeNull();

    const missing = row("Maps");
    expect(within(missing).getByText("File missing")).toBeInTheDocument();
    expect(within(missing).queryByRole("button", { name: "Download" })).toBeNull();
    expect(within(missing).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("opens a link in a new tab, cut off from this page", async () => {
    const user = renderSection([LINK]);

    await user.click(row("GameFAQs codes"));

    expect(openSpy).toHaveBeenCalledWith(
      "https://gamefaqs.gamespot.com/ps2/codes",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("opens a file in the reader, at #guides/<id>, and closes it again", async () => {
    const user = renderSection([FILE]);

    await user.click(row("Walkthrough"));

    expect(await screen.findByRole("dialog", { name: "Reader" })).toHaveTextContent(
      "Reading Walkthrough"
    );
    expect(currentHash).toBe("#guides/1");
    expect(openSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close reader" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Reader" })).toBeNull());
    expect(currentHash).toBe("");
  });

  it("opens the reader straight from a #guides/<id> address", async () => {
    renderSection([FILE], "/games/5#guides/1");

    expect(await screen.findByRole("dialog", { name: "Reader" })).toHaveTextContent(
      "Reading Walkthrough"
    );
  });

  it("drops a #guides/<id> address for a guide that isn't there", async () => {
    renderSection([FILE], "/games/5#guides/99");

    await waitFor(() => expect(currentHash).toBe(""));
    expect(screen.queryByRole("dialog", { name: "Reader" })).toBeNull();
  });

  it("opens Edit pointed at Replace for a missing file", async () => {
    const user = renderSection([MISSING]);

    await user.click(row("Maps"));

    expect(screen.getByRole("dialog")).toHaveTextContent("Editing Maps (replace)");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("downloads through a signed link", async () => {
    createGuideDownloadLink.mockResolvedValue("/api/guides/1/content/tok/walkthrough.pdf");
    const user = renderSection([FILE]);

    await user.click(within(row("Walkthrough")).getByRole("button", { name: "Download" }));

    await waitFor(() => expect(downloadFromUrl).toHaveBeenCalled());
    expect(createGuideDownloadLink).toHaveBeenCalledWith({ type: "game", id: 5 }, 1);
  });

  it("asks before deleting, and says what goes", async () => {
    deleteGuide.mockResolvedValue(undefined);
    const user = renderSection([LINK]);

    await user.click(within(row("GameFAQs codes")).getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog");
    expect(within(confirm).getByText("Delete “GameFAQs codes”?")).toBeInTheDocument();
    expect(within(confirm).getByText("Only the saved link is removed.")).toBeInTheDocument();
    expect(deleteGuide).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(deleteGuide).toHaveBeenCalledWith(2);
  });

  it("opens Add from the section", async () => {
    const user = renderSection([]);

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Adding");
  });
});
