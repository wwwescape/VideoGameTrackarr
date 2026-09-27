import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataManagementSection from "../DataManagementSection";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const exportBackup = vi.fn();
const restoreBackup = vi.fn();
const idle = { mutateAsync: vi.fn(), isPending: false };

vi.mock("../../hooks/useImportExport", () => ({
  useExportCsv: () => idle,
  useExportHardwareCsv: () => idle,
  useExportBackup: () => ({ mutateAsync: exportBackup, isPending: false }),
  useRestoreBackup: () => ({ mutateAsync: restoreBackup, isPending: false }),
  useRestoreStatus: () => ({ data: { status: "idle" } }),
}));

describe("DataManagementSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports the JSON backup by default, and the full .zip when files are included", async () => {
    const user = userEvent.setup();
    render(<DataManagementSection />);

    await user.click(screen.getByRole("button", { name: "Full backup (JSON)" }));
    expect(exportBackup).toHaveBeenLastCalledWith({ includeFiles: false });

    await user.click(screen.getByRole("checkbox", { name: "Include ROMs, saves and BIOS files" }));
    await user.click(screen.getByRole("button", { name: "Full backup with files (ZIP)" }));
    expect(exportBackup).toHaveBeenLastCalledWith({ includeFiles: true });
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
