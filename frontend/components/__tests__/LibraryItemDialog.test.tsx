import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EmulationConfig, PlatformResponse, RegionResponse, RomFileSummary } from "../../api/types";
import LibraryItemDialog from "../LibraryItemDialog";

const emulationConfig: EmulationConfig = {
  emulatorjsVersion: "4.2.3",
  cores: [],
  allowedUploadExtensions: { rom: ["gba", "nes", "zip"], abandonware: ["zip"], iso: ["chd", "iso", "zip"] },
  maxUploadMb: 1,
};

vi.mock("../../hooks/useLibrary", () => ({
  useEmulationConfig: () => ({ data: emulationConfig }),
}));

const nesRom: RomFileSummary = {
  id: 7,
  originalFilename: "Game (USA).nes",
  sizeBytes: 40976,
  extension: "nes",
  isArchive: false,
  playable: true,
  core: "fceumm",
  unplayableReason: null,
  saveStateCount: 0,
  hasInGameSave: false,
};

const platforms: PlatformResponse[] = [
  { id: 1, igdbId: 6, name: "PC (Microsoft Windows)", slug: "win", abbreviation: "PC" },
  { id: 2, igdbId: 48, name: "Sony PlayStation 4", slug: "ps4", abbreviation: "PS4" },
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

    expect(screen.queryByText("ROM file")).not.toBeInTheDocument();
    for (const format of ["ROM", "Abandonware", "ISO"]) {
      await user.click(screen.getByRole("radio", { name: format }));
      expect(screen.getByText("ROM file")).toBeInTheDocument();
    }
    await user.click(screen.getByRole("radio", { name: "Digital" }));
    expect(screen.queryByText("ROM file")).not.toBeInTheDocument();

    rerender(
      <LibraryItemDialog
        open
        title="Add game to your wishlist"
        status="wishlist"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "rom" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );
    expect(screen.queryByText("ROM file")).not.toBeInTheDocument();
  });

  it("passes the chosen ROM file to onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "rom" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        submitLabel="Add"
      />
    );

    const file = new File(["NES"], "Game.nes");
    await user.upload(screen.getByTestId("rom-file-input"), file);
    expect(screen.getByText(/Selected: Game\.nes/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ format: "rom" }), { file, remove: false });
  });

  it("blocks saving a ROM with a disallowed extension or over the size limit", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onSubmit = vi.fn();
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "rom" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        submitLabel="Add"
      />
    );

    await user.upload(screen.getByTestId("rom-file-input"), new File(["x"], "virus.exe"));
    expect(screen.getByText(/This file type isn't allowed for this format/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    await user.upload(screen.getByTestId("rom-file-input"), new File([new Uint8Array(1024 * 1024 + 1)], "big.nes"));
    expect(screen.getByText(/larger than the 1 MB upload limit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the existing ROM and can mark it for removal", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <LibraryItemDialog
        open
        title="Update game in your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "rom" }}
        existingRom={nesRom}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        submitLabel="Update"
      />
    );

    expect(screen.getByText(/Game \(USA\)\.nes/)).toBeInTheDocument();
    expect(screen.getByText("Playable in browser")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove ROM" }));
    expect(screen.getByText("The ROM will be removed when you save.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), { file: null, remove: true });
  });

  it("warns that changing the format away from ROM deletes the attached ROM", async () => {
    const user = userEvent.setup();
    render(
      <LibraryItemDialog
        open
        title="Update game in your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "rom" }}
        existingRom={nesRom}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Update"
      />
    );

    expect(screen.queryByText(/will be deleted when you save/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Physical" }));
    expect(screen.getByText(/will be deleted when you save/)).toBeInTheDocument();
  });

  it("warns that replacing or removing a ROM deletes its saves", async () => {
    const user = userEvent.setup();
    render(
      <LibraryItemDialog
        open
        title="Update game in your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "rom" }}
        existingRom={{ ...nesRom, saveStateCount: 2, hasInGameSave: true }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Update"
      />
    );

    const warning = /2 save states and in-game save will be deleted/;
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await user.upload(screen.getByTestId("rom-file-input"), new File(["NES"], "Other.nes"));
    expect(screen.getByText(warning)).toBeInTheDocument();
    // The ROM block's own Cancel (discard the picked file) comes before the dialog's.
    await user.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove ROM" }));
    expect(screen.getByText(warning)).toBeInTheDocument();
  });

  it("locks the dialog and shows progress while a ROM uploads", () => {
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        status="owned"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "rom" }}
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
});
