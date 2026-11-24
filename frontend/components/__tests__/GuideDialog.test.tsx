import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, CanceledError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Guide, LibraryItem, PlatformResponse } from "../../api/types";
import GuideDialog from "../GuideDialog";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const createFile = vi.fn();
const createLink = vi.fn();
const updateGuide = vi.fn();
const replaceFile = vi.fn();
vi.mock("../../hooks/useGuides", () => ({
  useGuideUploadOptions: () => ({
    data: { maxUploadMb: 1, extensions: ["pdf", "docx", "md", "markdown", "txt"] },
  }),
  useCreateGuideFile: () => ({ mutateAsync: createFile }),
  useCreateGuideLink: () => ({ mutateAsync: createLink }),
  useUpdateGuide: () => ({ mutateAsync: updateGuide }),
  useReplaceGuideFile: () => ({ mutateAsync: replaceFile }),
}));

const LIBRARY = [{ platformId: 8, platformName: "PlayStation 2" }] as LibraryItem[];
const GAME_PLATFORMS = [
  { id: 8, igdbId: 8, name: "PlayStation 2", slug: "ps2", abbreviation: "PS2" },
  { id: 9, igdbId: 6, name: "PC (Microsoft Windows)", slug: "win", abbreviation: "PC" },
] as PlatformResponse[];

const FILE_GUIDE: Guide = {
  id: 4,
  gameId: 5,
  name: "Walkthrough",
  kind: "guide",
  source: "file",
  platformId: 8,
  platformName: "PlayStation 2",
  url: null,
  domain: null,
  originalFilename: "walkthrough.pdf",
  mediaFormat: "pdf",
  sizeBytes: 2048,
  fileMissing: false,
  createdAt: "2026-11-24T10:00:00Z",
  updatedAt: "2026-11-24T10:00:00Z",
};
const LINK_GUIDE: Guide = {
  ...FILE_GUIDE,
  id: 6,
  name: "Wiki",
  source: "link",
  url: "https://example.com/wiki",
  domain: "example.com",
  originalFilename: null,
  mediaFormat: null,
  sizeBytes: null,
};

function renderDialog(guide?: Guide) {
  const onClose = vi.fn();
  render(
    <GuideDialog
      open
      gameId={5}
      guide={guide}
      libraryItems={LIBRARY}
      gamePlatforms={GAME_PLATFORMS}
      onClose={onClose}
    />
  );
  // Let HTML and .doc files through the input's accept list, so the dialog's own check runs.
  return { user: userEvent.setup({ applyAccept: false }), onClose };
}

const fileInput = () => screen.getByTestId("guide-file-input") as HTMLInputElement;
const pdf = (name = "Boss Guide.pdf", size = 10) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });
const saveButton = (name: "Add" | "Save") => screen.getByRole("button", { name });

function serverError(status: number, detail: string) {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data: { detail },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe("GuideDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createFile.mockResolvedValue({});
    createLink.mockResolvedValue({});
    updateGuide.mockResolvedValue({});
    replaceFile.mockResolvedValue({});
  });

  it("adds a file, naming it after the file and sending type and platform", async () => {
    const { user, onClose } = renderDialog();
    expect(saveButton("Add")).toBeDisabled();
    expect(screen.getByText("PDF, Word (.docx), Markdown or text, up to 1 MB")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cheat" }));
    await user.upload(fileInput(), pdf());
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Boss Guide");
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Other platforms")).toBeInTheDocument();
    await user.click(within(listbox).getByRole("option", { name: "PlayStation 2" }));
    await user.click(saveButton("Add"));

    expect(createFile).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { kind: "cheat", name: "Boss Guide", platformId: 8 } })
    );
    expect(createFile.mock.calls[0][0].file.name).toBe("Boss Guide.pdf");
    expect(onClose).toHaveBeenCalled();
  });

  it("stops filling in the name once you've typed one", async () => {
    const { user } = renderDialog();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "My notes");
    await user.upload(fileInput(), pdf("other.pdf"));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("My notes");
  });

  it.each([
    ["page.html", "HTML files aren't supported. Save it as PDF, or add it as a link."],
    ["old.doc", "Old Word (.doc) files aren't supported. Save it as .docx or PDF."],
    ["game.exe", "Use PDF, Word (.docx), Markdown or text."],
  ])("refuses %s before uploading it", async (name, message) => {
    const { user } = renderDialog();

    await user.upload(fileInput(), new File(["x"], name));

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(saveButton("Add")).toBeDisabled();
  });

  it("refuses a file over the limit", async () => {
    const { user } = renderDialog();

    await user.upload(fileInput(), pdf("big.pdf", 1024 * 1024 + 1));

    expect(screen.getByText("This file is larger than 1 MB.")).toBeInTheDocument();
    expect(saveButton("Add")).toBeDisabled();
  });

  it("adds a link, refusing a bad one and naming a good one after its site", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("radio", { name: "Link" }));
    const field = screen.getByRole("textbox", { name: "Link" });

    await user.type(field, "javascript:alert(1)");
    await user.tab();
    expect(screen.getByText("Enter a full http or https link.")).toBeInTheDocument();
    expect(saveButton("Add")).toBeDisabled();

    await user.clear(field);
    await user.type(field, "https://www.gamefaqs.gamespot.com/ps2/faqs");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("gamefaqs.gamespot.com");
    await user.click(saveButton("Add"));

    expect(createLink).toHaveBeenCalledWith({
      url: "https://www.gamefaqs.gamespot.com/ps2/faqs",
      fields: { kind: "guide", name: "gamefaqs.gamespot.com", platformId: null },
    });
  });

  it("only sends what changed when editing", async () => {
    const { user } = renderDialog(FILE_GUIDE);
    expect(screen.getByText("walkthrough.pdf")).toBeInTheDocument();
    expect(saveButton("Save")).toBeEnabled();

    const name = screen.getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Full walkthrough");
    await user.click(saveButton("Save"));

    expect(updateGuide).toHaveBeenCalledWith({ guideId: 4, changes: { name: "Full walkthrough" } });
    expect(replaceFile).not.toHaveBeenCalled();
  });

  it("replaces the file", async () => {
    const { user } = renderDialog(FILE_GUIDE);

    await user.upload(fileInput(), pdf("v2.pdf"));
    await user.click(saveButton("Save"));

    expect(updateGuide).not.toHaveBeenCalled();
    expect(replaceFile).toHaveBeenCalledWith(expect.objectContaining({ guideId: 4 }));
    expect(replaceFile.mock.calls[0][0].file.name).toBe("v2.pdf");
  });

  it("asks before switching a file to a link", async () => {
    const { user } = renderDialog(FILE_GUIDE);

    await user.click(screen.getByRole("radio", { name: "Link" }));
    await user.type(screen.getByRole("textbox", { name: "Link" }), "https://example.com/guide");
    await user.click(saveButton("Save"));
    expect(updateGuide).not.toHaveBeenCalled();
    expect(screen.getByText("The uploaded file is deleted when you save.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch to link" }));
    await waitFor(() =>
      expect(updateGuide).toHaveBeenCalledWith({
        guideId: 4,
        changes: { url: "https://example.com/guide" },
      })
    );
  });

  it("turns a link into a file", async () => {
    const { user } = renderDialog(LINK_GUIDE);
    expect(screen.getByRole("textbox", { name: "Link" })).toHaveValue("https://example.com/wiki");

    await user.click(screen.getByRole("radio", { name: "File" }));
    expect(saveButton("Save")).toBeDisabled();
    await user.upload(fileInput(), pdf("wiki.pdf"));
    await user.click(saveButton("Save"));

    expect(replaceFile).toHaveBeenCalledWith(expect.objectContaining({ guideId: 6 }));
  });

  it("shows the server's message on the field it's about", async () => {
    createFile.mockRejectedValue(serverError(400, "This isn't a valid PDF file"));
    const { user, onClose } = renderDialog();

    await user.upload(fileInput(), pdf());
    await user.click(saveButton("Add"));

    expect(await screen.findByText("This isn't a valid PDF file")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels an upload that's still running", async () => {
    let signal: AbortSignal | undefined;
    createFile.mockImplementation(
      (args: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal = args.signal;
          args.signal.addEventListener("abort", () => reject(new CanceledError()));
        })
    );
    const { user, onClose } = renderDialog();

    await user.upload(fileInput(), pdf());
    await user.click(saveButton("Add"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(signal?.aborted).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
