import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlatformResponse } from "../../api/types";
import PlatformTemplateDialog from "../PlatformTemplateDialog";

const setCaseSize = vi.fn().mockResolvedValue(undefined);

vi.mock("../../hooks/usePlatforms", () => ({
  useSetPlatformCaseSize: () => ({ mutateAsync: setCaseSize, isPending: false }),
  useSetPlatformSpineTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetPlatformSpineStyle: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../hooks/useUploads", () => ({
  useUploadSpine: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const platform: PlatformResponse = {
  id: 2,
  igdbId: 48,
  name: "Sony PlayStation 4",
  slug: "ps4",
  abbreviation: "PS4",
  spineTemplateUrl: null,
  caseHeightMm: null,
  caseSpineMm: null,
  spineColor: null,
  spineIcon: null,
  spineIconUrl: null,
};

describe("PlatformTemplateDialog case size", () => {
  it("offers the Slim DVD preset in the dropdown", async () => {
    const user = userEvent.setup();
    render(<PlatformTemplateDialog platform={platform} onClose={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: "Case size" }));
    expect(
      screen.getByRole("option", { name: "Slim DVD case (184 × 7 mm)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "DVD case (184 × 14 mm)" })
    ).toBeInTheDocument();
  });

  it("asks for a custom size and saves the entered millimetres", async () => {
    const user = userEvent.setup();
    render(<PlatformTemplateDialog platform={platform} onClose={() => {}} />);
    await user.click(screen.getByRole("combobox", { name: "Case size" }));
    await user.click(screen.getByRole("option", { name: "Custom…" }));

    // Prefilled from the size currently in effect (PS4 = Blu-ray 171 x 12).
    const height = screen.getByLabelText("Height (mm)");
    const spine = screen.getByLabelText("Spine (mm)");
    expect(height).toHaveValue(171);
    expect(spine).toHaveValue(12);

    await user.clear(height);
    await user.type(height, "200");
    await user.clear(spine);
    await user.type(spine, "20");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(setCaseSize).toHaveBeenCalledWith({
      platformId: 2,
      heightMm: 200,
      spineMm: 20,
    });
  });
});
