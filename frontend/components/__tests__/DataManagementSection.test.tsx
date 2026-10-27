import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagementSection from "../DataManagementSection";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const exportBackup = vi.fn();
const restoreBackup = vi.fn();

vi.mock("../../hooks/useImportExport", () => ({
  useExportBackup: () => ({ mutateAsync: exportBackup, isPending: false }),
  useRestoreBackup: () => ({ mutateAsync: restoreBackup, isPending: false }),
  useRestoreStatus: () => ({ data: { status: "idle" } }),
}));

describe("DataManagementSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has one backup: a .json by default, a .zip with the files picked", async () => {
    const user = userEvent.setup();
    render(<DataManagementSection />);

    // The CSV exports are gone: JSON is the one format, and it restores.
    expect(screen.queryByRole("button", { name: /CSV/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Download backup (.json)" }));
    expect(exportBackup).toHaveBeenLastCalledWith({ roms: false, bios: false, images: false });

    await user.click(screen.getByRole("checkbox", { name: "ROMs and saves" }));
    await user.click(screen.getByRole("checkbox", { name: /Images/ }));
    await user.click(screen.getByRole("button", { name: "Download backup (.zip)" }));
    expect(exportBackup).toHaveBeenLastCalledWith({ roms: true, bios: false, images: true });
  });

  it("restores from a .zip full backup as well as .json", async () => {
    const user = userEvent.setup();
    render(<DataManagementSection />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain(".zip");
    const zip = new File(["PK"], "videogametrackarr-full-backup.zip", { type: "application/zip" });
    await user.upload(input, zip);
    await user.click(screen.getByRole("button", { name: "Replace my library" }));

    expect(restoreBackup).toHaveBeenCalledWith(zip);
  });
});
