import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { PlatformResponse } from "../../api/types";
import BulkAddDialog from "../BulkAddDialog";

const startBulkImport = vi.fn().mockResolvedValue({ status: "running" });

vi.mock("../../hooks/useGames", () => ({
  useStartBulkImport: () => ({ mutateAsync: startBulkImport, isPending: false }),
}));

const platforms: PlatformResponse[] = [
  { id: 1, igdbId: 6, name: "PC (Microsoft Windows)", slug: "win", abbreviation: "PC", gameCount: 0 },
];

vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({ data: platforms }),
}));

vi.mock("../../hooks/useTags", () => ({
  useTags: () => ({ data: [] }),
  useCreateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderDialog(igdbIds: number[] = [1, 2]) {
  return render(
    <MemoryRouter initialEntries={["/games/add"]}>
      <Routes>
        <Route
          path="/games/add"
          element={<BulkAddDialog open igdbIds={igdbIds} onClose={vi.fn()} />}
        />
        <Route path="/games" element={<div>Games list page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BulkAddDialog", () => {
  it("shows the selection count on Step 1", () => {
    renderDialog([1, 2, 3]);

    expect(screen.getByText("3 games will be added.")).toBeInTheDocument();
  });

  it("lets Step 3 be skipped, starting the import with no library defaults and navigating to the Games list", async () => {
    const user = userEvent.setup();
    renderDialog([1, 2]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(startBulkImport).toHaveBeenCalledWith({
      igdbIds: [1, 2],
      tagIds: [],
      libraryDefaults: null,
    });
    expect(await screen.findByText("Games list page")).toBeInTheDocument();
  });

  it("disables 'Add N games' on Step 3 until a Platform is chosen", async () => {
    const user = userEvent.setup();
    renderDialog([1]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.getByRole("button", { name: "Add 1 game" })).toBeDisabled();

    await user.click(screen.getByLabelText("Platform"));
    await user.click(await screen.findByRole("option", { name: "PC (Microsoft Windows) (PC)" }));

    expect(screen.getByRole("button", { name: "Add 1 game" })).toBeEnabled();
  });

  it("submits with library defaults filled in when 'Add N games' is clicked", async () => {
    const user = userEvent.setup();
    renderDialog([1]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByLabelText("Platform"));
    await user.click(await screen.findByRole("option", { name: "PC (Microsoft Windows) (PC)" }));
    await user.click(screen.getByRole("button", { name: "Add 1 game" }));

    expect(startBulkImport).toHaveBeenCalledWith({
      igdbIds: [1],
      tagIds: [],
      libraryDefaults: { status: "owned", platformId: 1, format: "physical", digitalStorefront: undefined },
    });
  });
});
