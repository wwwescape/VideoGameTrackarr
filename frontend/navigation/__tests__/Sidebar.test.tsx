import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "../Sidebar";

vi.mock("../../hooks/useDashboard", () => ({
  useDashboardStats: () => ({ data: { totalTracked: 224 } }),
}));
vi.mock("../../hooks/useHardwareStats", () => ({
  useHardwareStats: () => ({ data: { ownedConsoles: 3, ownedAccessories: 4, wishlistHardware: 1 } }),
}));
vi.mock("../../hooks/useVersion", () => ({
  useVersion: () => ({ data: { currentVersion: "2.0.0" } }),
}));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  );
  return screen.getByRole("navigation", { name: "Main navigation" });
}

describe("Sidebar", () => {
  it("groups the sections and shows the game and hardware counts", () => {
    const nav = renderAt("/");

    expect(within(nav).getByText("Library")).toBeInTheDocument();
    expect(within(nav).getByText("System")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /Games\s*224/ })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Hardware\s*8/ })).toBeInTheDocument();
    expect(screen.getByText("v2.0.0")).toBeInTheDocument();
  });

  it("shows a section's sub-pages only while you're in it, highlighting the one you're on", () => {
    const nav = renderAt("/games/series");

    expect(within(nav).getByRole("link", { name: "Series" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Collections" })).not.toHaveAttribute("aria-current");
    // The parent isn't highlighted while one of its sub-pages is.
    expect(within(nav).getByRole("link", { name: /Games/ })).not.toHaveAttribute("aria-current");
    expect(within(nav).queryByRole("link", { name: "Tag Manager" })).not.toBeInTheDocument();
  });

  it("treats a game's own page as part of Games", () => {
    const nav = renderAt("/game/hollow-knight");

    expect(within(nav).getByRole("link", { name: /Games/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Add Game" })).toBeInTheDocument();
  });

  it("lists every Settings page under Settings", () => {
    const nav = renderAt("/settings/steam-sync");

    for (const name of ["Tag Manager", "Jobs", "Integrations", "Emulation", "Sale - Tracked", "Sale - Ignored List"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "Steam Sync" })).toHaveAttribute("aria-current", "page");
  });
});
