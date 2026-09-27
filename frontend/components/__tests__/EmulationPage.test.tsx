import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BiosSystem } from "../../api/types";
import EmulationPage from "../EmulationPage";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const uploadBios = vi.fn();
const deleteBios = vi.fn();
let systems: BiosSystem[] = [];

vi.mock("../../hooks/useLibrary", () => ({
  useBiosSystems: () => ({ data: systems, isLoading: false, isError: false }),
  useUploadBios: () => ({ mutateAsync: uploadBios, isPending: false }),
  useDeleteBios: () => ({ mutate: deleteBios }),
}));

const lynx: BiosSystem = {
  key: "lynx",
  label: "Atari Lynx",
  required: true,
  ready: false,
  systems: ["Atari Lynx"],
  acceptedFiles: [{ filename: "lynxboot.img", note: null, satisfies: true, hasReferenceHash: true }],
  uploadedFiles: [],
};

const threeDo: BiosSystem = {
  key: "3do",
  label: "3DO",
  required: true,
  ready: true,
  systems: ["3DO"],
  acceptedFiles: [
    { filename: "panafz10.bin", note: "Panasonic FZ-10", satisfies: true, hasReferenceHash: true },
    { filename: "panafz1-kanji.bin", note: null, satisfies: false, hasReferenceHash: true },
  ],
  uploadedFiles: [
    {
      id: 4,
      filename: "panafz10.bin",
      sizeBytes: 1048576,
      md5: "51f2f43ae2f3508a14d9f56597e2d3ce",
      recognized: true,
      updatedAt: "2026-09-27T10:00:00Z",
    },
  ],
};

const psx: BiosSystem = {
  key: "psx",
  label: "PlayStation",
  required: false,
  ready: false,
  systems: ["PlayStation"],
  acceptedFiles: [{ filename: "scph5501.bin", note: "USA", satisfies: true, hasReferenceHash: true }],
  uploadedFiles: [],
};

function renderPage() {
  render(
    <MemoryRouter>
      <EmulationPage />
    </MemoryRouter>
  );
}

describe("EmulationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    systems = [psx, lynx, threeDo];
  });

  it("shows one card per system, alphabetically, with its status and the legal note", () => {
    renderPage();

    expect(screen.getByText(/Only upload BIOS files dumped from consoles you own/)).toBeInTheDocument();
    const titles = screen.getAllByTestId(/^bios-system-/).map((card) => card.getAttribute("data-testid"));
    expect(titles).toEqual(["bios-system-3do", "bios-system-lynx", "bios-system-psx"]);
    expect(within(screen.getByTestId("bios-system-lynx")).getByText("Needed to play")).toBeInTheDocument();
    expect(within(screen.getByTestId("bios-system-3do")).getByText("Ready")).toBeInTheDocument();
    expect(within(screen.getByTestId("bios-system-psx")).getByText("Optional")).toBeInTheDocument();
  });

  it("shows an uploaded file's checksum and whether it's a known-good dump", () => {
    renderPage();

    const row = within(screen.getByTestId("bios-file-panafz10.bin"));
    expect(row.getByText("Recognized dump")).toBeInTheDocument();
    expect(row.getByText(/MD5 51f2f43ae2f3508a14d9f56597e2d3ce/)).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Upload panafz10.bin" })).toHaveTextContent("Replace");
    expect(screen.getByText(/extra file, not enough on its own/)).toBeInTheDocument();
  });

  it("uploads a picked file under the name the core expects", async () => {
    const user = userEvent.setup();
    uploadBios.mockResolvedValue(lynx);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Upload lynxboot.img" }));
    await user.upload(screen.getByTestId("bios-input-lynx"), new File(["BIOS"], "Lynx Boot ROM (World).img"));

    expect(uploadBios).toHaveBeenCalledTimes(1);
    const [{ system, file }] = uploadBios.mock.calls[0] as [{ system: string; file: File }];
    expect(system).toBe("lynx");
    expect(file.name).toBe("lynxboot.img");
  });

  it("deletes a file after confirming", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Delete panafz10.bin" }));
    expect(screen.getByText(/panafz10\.bin will be deleted from the server/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteBios).toHaveBeenCalledWith(4, expect.anything());
  });
});
