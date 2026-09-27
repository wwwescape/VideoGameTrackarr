import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import About from "../About";

vi.mock("../../hooks/useVersion", () => ({
  useVersion: () => ({ data: undefined, checkForUpdates: vi.fn(), isFetching: false }),
}));

vi.mock("../../hooks/useLibrary", () => ({
  useEmulationConfig: () => ({
    data: {
      emulatorjsVersion: "4.2.3",
      maxUploadMb: 2048,
      allowedUploadExtensions: {},
      cores: [
        {
          core: "fceumm",
          system: "Nintendo Entertainment System / Famicom",
          license: "GPL-2.0",
          upstreamUrl: "https://github.com/libretro/libretro-fceumm",
          nonCommercial: false,
        },
        {
          core: "snes9x",
          system: "Super Nintendo / Super Famicom",
          license: "Snes9x License",
          upstreamUrl: "https://github.com/libretro/snes9x",
          nonCommercial: true,
        },
      ],
    },
  }),
}));

describe("About emulator credits", () => {
  it("credits EmulatorJS and lists every core with its license, flagging non-commercial ones", () => {
    render(<About />);

    expect(screen.getByText(/EmulatorJS/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "fceumm" })).toHaveAttribute(
      "href",
      "https://github.com/libretro/libretro-fceumm"
    );
    const fceumm = screen.getByRole("link", { name: "fceumm" }).closest("li") as HTMLElement;
    const snes9x = screen.getByRole("link", { name: "snes9x" }).closest("li") as HTMLElement;
    expect(fceumm).toHaveTextContent("GPL-2.0");
    expect(fceumm).not.toHaveTextContent("non-commercial");
    expect(snes9x).toHaveTextContent("Snes9x License (non-commercial use only)");
  });
});
