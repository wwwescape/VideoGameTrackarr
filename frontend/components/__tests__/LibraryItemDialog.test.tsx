import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EmulationConfig, PlatformResponse, RegionResponse, RomFileSummary } from "../../api/types";
import LibraryItemDialog from "../LibraryItemDialog";

const emulationConfig: EmulationConfig = {
  emulatorjsVersion: "4.2.3",
  cores: [],
  allowedUploadExtensions: { rom: ["gba", "nes", "zip"], abandonware: ["zip"], iso: ["chd", "iso", "zip"] },
  maxUploadMb: 1,
  supportedPlatformSlugs: ["nes", "gba"],
};

const createRomDownloadLink = vi.fn();
vi.mock("../../api/library", () => ({
  createRomDownloadLink: (...args: unknown[]) => createRomDownloadLink(...args),
}));

const downloadFromUrl = vi.fn();
vi.mock("../../utils/download", () => ({
  downloadFromUrl: (...args: unknown[]) => downloadFromUrl(...args),
}));

vi.mock("../../hooks/useLibrary", () => ({
  useEmulationConfig: () => ({ data: emulationConfig }),
}));

const nesRom: RomFileSummary = {
  id: 7,
  label: null,
  originalFilename: "Game (USA).nes",
  sizeBytes: 40976,
  extension: "nes",
  isArchive: false,
  playable: true,
  core: "fceumm",
  unplayableReason: null,
  missingBiosSystem: null,
  isolated: false,
  saveStateCount: 0,
  hasInGameSave: false,
};

const noChanges = { added: [], replaced: [], relabelled: [], removed: [] };

const platforms: PlatformResponse[] = [
  { id: 1, igdbId: 6, name: "PC (Microsoft Windows)", slug: "win", abbreviation: "PC" },
  { id: 2, igdbId: 48, name: "Sony PlayStation 4", slug: "ps4", abbreviation: "PS4" },
  { id: 3, igdbId: 18, name: "Nintendo Entertainment System", slug: "nes", abbreviation: "NES" },
];

const regions: RegionResponse[] = [{ id: 1, name: "Worldwide" }];

describe("LibraryItemDialog", () => {
  it("shows Digital Storefront when PC and Digital format are selected", async () => {
    const user = userEvent.setup();
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    expect(screen.queryByLabelText("Digital Storefront")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Platform *"));
    await user.click(await screen.findByRole("option", { name: "PC (Microsoft Windows)" }));

    await user.click(screen.getByRole("radio", { name: "Digital" }));

    expect(await screen.findByLabelText("Digital Storefront")).toBeInTheDocument();
  });

  it("shows Digital Storefront when format is picked before platform", async () => {
    const user = userEvent.setup();
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    await user.click(screen.getByRole("radio", { name: "Digital" }));

    await user.click(screen.getByLabelText("Platform *"));
    await user.click(await screen.findByRole("option", { name: "PC (Microsoft Windows)" }));

    expect(await screen.findByLabelText("Digital Storefront")).toBeInTheDocument();
  });

  it("shows Digital Storefront when editing an existing PC/Digital item", async () => {
    render(
      <LibraryItemDialog
        open
        title="Update game in your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "digital" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Update"
      />
    );

    expect(await screen.findByLabelText("Digital Storefront")).toBeInTheDocument();
  });

  it("shows Steelbook only while Format is Physical", async () => {
    const user = userEvent.setup();
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    // Physical is the default format, so Steelbook starts visible with no interaction needed.
    expect(screen.getByLabelText("Steelbook")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Digital" }));
    expect(screen.queryByLabelText("Steelbook")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Physical" }));
    expect(screen.getByLabelText("Steelbook")).toBeInTheDocument();
  });

  it("always shows Edition and Notes fields", () => {
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    expect(screen.getByLabelText("Edition")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("shows the ROM upload field only for owned ROM, Abandonware and ISO copies", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    expect(screen.queryByText("ROM files")).not.toBeInTheDocument();
    for (const format of ["ROM", "Abandonware", "ISO"]) {
      await user.click(screen.getByRole("radio", { name: format }));
      expect(screen.getByText("ROM files")).toBeInTheDocument();
    }
    await user.click(screen.getByRole("radio", { name: "Digital" }));
    expect(screen.queryByText("ROM files")).not.toBeInTheDocument();

    rerender(
      <LibraryItemDialog
        open
        title="Add game to your wishlist"
        status="wishlist"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 3, format: "rom" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );
    expect(screen.queryByText("ROM files")).not.toBeInTheDocument();
  });

  const renderRomDialog = (props: Partial<Parameters<typeof LibraryItemDialog>[0]> = {}) => {
    const onSubmit = vi.fn();
    render(
      <LibraryItemDialog
        open
        title="Update game in your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 3, format: "rom" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        submitLabel="Update"
        {...props}
      />
    );
    return onSubmit;
  };

  it("passes the chosen ROM files, with labels, to onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = renderRomDialog({ submitLabel: "Add" });

    const usa = new File(["NES"], "usa.nes");
    const japan = new File(["NES"], "japan.nes");
    await user.upload(screen.getByTestId("rom-file-input"), [usa, japan]);
    expect(screen.getByText(/Selected: usa\.nes/)).toBeInTheDocument();
    expect(screen.getByText(/Selected: japan\.nes/)).toBeInTheDocument();
    await user.type(screen.getAllByRole("textbox", { name: "Label (optional)" })[0], " USA ");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ format: "rom" }), {
      ...noChanges,
      added: [
        { file: usa, label: "USA" },
        { file: japan, label: null },
      ],
    });
  });

  it("blocks saving a ROM with a disallowed extension or over the size limit", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onSubmit = renderRomDialog({ submitLabel: "Add" });

    await user.upload(screen.getByTestId("rom-file-input"), new File(["x"], "virus.exe"));
    expect(screen.getByText(/This file type isn't allowed for this format/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    // Dropping the bad file unblocks saving again.
    await user.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();

    await user.upload(screen.getByTestId("rom-file-input"), new File([new Uint8Array(1024 * 1024 + 1)], "big.nes"));
    expect(screen.getByText(/larger than the 1 MB upload limit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows each existing ROM and can remove, replace and relabel them separately", async () => {
    const user = userEvent.setup();
    const second: RomFileSummary = { ...nesRom, id: 8, label: "Japan", originalFilename: "Game (J).nes" };
    const onSubmit = renderRomDialog({ existingRoms: [nesRom, second] });

    const first = within(screen.getByTestId("rom-row-7"));
    const other = within(screen.getByTestId("rom-row-8"));
    expect(first.getByText(/Game \(USA\)\.nes/)).toBeInTheDocument();
    expect(first.getByText("Playable in browser")).toBeInTheDocument();
    expect(other.getByRole("textbox", { name: "Label (optional)" })).toHaveValue("Japan");
    expect(screen.getByRole("button", { name: "Add another ROM" })).toBeInTheDocument();

    await user.click(first.getByRole("button", { name: "Remove ROM" }));
    expect(first.getByText("The ROM will be removed when you save.")).toBeInTheDocument();
    await user.click(other.getByRole("button", { name: "Replace ROM" }));
    const replacement = new File(["NES"], "Game (J) Rev 1.nes");
    await user.upload(screen.getByTestId("rom-file-input"), replacement);
    expect(other.getByText(/Replacing with: Game \(J\) Rev 1\.nes/)).toBeInTheDocument();
    await user.clear(other.getByRole("textbox", { name: "Label (optional)" }));
    await user.type(other.getByRole("textbox", { name: "Label (optional)" }), "Japan Rev 1");
    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), {
      added: [],
      removed: [7],
      replaced: [{ romId: 8, file: replacement }],
      relabelled: [{ romId: 8, label: "Japan Rev 1" }],
    });
  });

  it("explains a ROM that needs a BIOS", () => {
    renderRomDialog({
      existingRoms: [{ ...nesRom, playable: false, unplayableReason: "missing_bios", missingBiosSystem: "lynx" }],
    });

    expect(screen.getByText(/needs a BIOS file \(Settings → Emulation\)/)).toBeInTheDocument();
  });

  it("warns that changing the format away from ROM deletes every attached ROM", async () => {
    const user = userEvent.setup();
    const onSubmit = renderRomDialog({ existingRoms: [nesRom, { ...nesRom, id: 8, originalFilename: "b.nes" }] });

    expect(screen.queryByText(/will be deleted when you save/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Physical" }));
    expect(screen.getByText(/This copy's 2 ROMs \(Game \(USA\)\.nes, b\.nes\) will be deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ format: "physical" }), noChanges);
  });

  it("warns that replacing or removing a ROM deletes only that ROM's saves", async () => {
    const user = userEvent.setup();
    renderRomDialog({
      existingRoms: [
        { ...nesRom, saveStateCount: 2, hasInGameSave: true },
        { ...nesRom, id: 8, originalFilename: "b.nes", saveStateCount: 3 },
      ],
    });

    const warning = /^2 save states and in-game save will be deleted/;
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    const first = within(screen.getByTestId("rom-row-7"));
    await user.click(first.getByRole("button", { name: "Replace ROM" }));
    await user.upload(screen.getByTestId("rom-file-input"), new File(["NES"], "Other.nes"));
    expect(screen.getByText(warning)).toBeInTheDocument();
    await user.click(first.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await user.click(first.getByRole("button", { name: "Remove ROM" }));
    expect(screen.getByText(warning)).toBeInTheDocument();
    await user.click(within(screen.getByTestId("rom-row-8")).getByRole("button", { name: "Remove ROM" }));
    expect(screen.getByText(/^5 save states and in-game save will be deleted/)).toBeInTheDocument();
  });

  it("locks the dialog and shows progress while a ROM uploads", () => {
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 3, format: "rom" }}
        uploadProgress={0.42}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    expect(screen.getByText("Uploading… 42%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("says which upload is in flight when several ROMs are sent", () => {
    renderRomDialog({ uploadProgress: 0.5, uploadStep: { current: 2, total: 3 } });

    expect(screen.getByText("Uploading 2 of 3… 50%")).toBeInTheDocument();
  });

  it("shows a note instead of upload controls for a platform ROMs aren't supported on", () => {
    renderRomDialog({
      defaultValues: { platformId: 2, format: "iso" },
      existingRoms: [{ ...nesRom, playable: false, unplayableReason: "unsupported_platform" }],
    });

    expect(screen.getByText(/ROMs aren't supported for Sony PlayStation 4/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add another ROM" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace ROM" })).not.toBeInTheDocument();
    // An already-stored ROM can still be downloaded or removed.
    expect(screen.getByRole("button", { name: "Download ROM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove ROM" })).toBeInTheDocument();
  });

  it("drops picked files if the platform is switched to an unsupported one", async () => {
    const user = userEvent.setup();
    const onSubmit = renderRomDialog({ submitLabel: "Add" });

    await user.upload(screen.getByTestId("rom-file-input"), new File(["NES"], "game.nes"));
    await user.click(screen.getByRole("combobox", { name: /Platform/ }));
    await user.click(await screen.findByRole("option", { name: "Sony PlayStation 4" }));
    expect(screen.queryByText(/Selected: game\.nes/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ platformId: 2 }), noChanges);
  });

  it("puts Download ROM between Replace ROM and Remove ROM, and downloads through a signed link", async () => {
    const user = userEvent.setup();
    createRomDownloadLink.mockResolvedValue("/api/roms/7/content/tok/Game%20(USA).nes");
    renderRomDialog({ existingRoms: [nesRom] });

    const row = within(screen.getByTestId("rom-row-7"));
    const labels = row.getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["Replace ROM", "Download ROM", "Remove ROM"]);
    await user.click(row.getByRole("button", { name: "Download ROM" }));

    expect(createRomDownloadLink).toHaveBeenCalledWith(7);
    expect(downloadFromUrl).toHaveBeenCalledWith(expect.stringMatching(/\/api\/roms\/7\/content\/tok\//));
  });
});
