import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FilterPresetsSettingsPage from "../FilterPresetsSettingsPage";

let labOn = true;
vi.mock("../../hooks/useLabs", () => ({
  useLabs: () => ({
    data: [{ id: "filter_presets", enabled: labOn }],
    isError: false,
    isFetchedAfterMount: true,
    fetchStatus: "idle",
  }),
  useEnabledLabs: () => new Set(labOn ? ["filter_presets"] : []),
}));
vi.mock("../../hooks/useGameFilterPreferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useGameFilterPreferences")>()),
  useGameFilterPreferences: () => ({
    hiddenFields: new Set(["format"]),
    setHiddenFields: vi.fn(),
    savedFilters: [{ name: "Couch co-op", filters: {} }],
    deleteFilter: vi.fn(),
    renameFilter: vi.fn(),
    restoreFilter: vi.fn(),
    saving: false,
  }),
}));
vi.mock("../SettingsFrame", () => ({
  default: ({ children, description }: { children: React.ReactNode; description: string }) => (
    <div>
      <p>{description}</p>
      {children}
    </div>
  ),
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/settings/filter-presets", element: <FilterPresetsSettingsPage /> },
      { path: "/settings/labs", element: <div>Labs page</div> },
    ],
    { initialEntries: ["/settings/filter-presets"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("FilterPresetsSettingsPage", () => {
  beforeEach(() => {
    labOn = true;
  });

  it("holds both the Filter fields and the saved presets", () => {
    renderPage();

    expect(screen.getByText(/Which fields the game lists' Filter dialog shows/)).toBeInTheDocument();
    expect(screen.getByText(/18 of 19 fields shown/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Couch co-op" })).toBeInTheDocument();
  });

  it("sends you to Labs while the Filter Presets lab is off", () => {
    labOn = false;
    const router = renderPage();

    expect(router.state.location.pathname).toBe("/settings/labs");
    expect(screen.queryByRole("button", { name: "Customize" })).not.toBeInTheDocument();
  });
});
