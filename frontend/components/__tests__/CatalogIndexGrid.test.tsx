import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// jsdom doesn't implement ResizeObserver — VirtualGameGrid.tsx needs it once entries render.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);
import CatalogIndexGrid from "../CatalogIndexGrid";

function renderGrid(stateKey: string) {
  return render(
    <MemoryRouter>
      <CatalogIndexGrid
        stateKey={stateKey}
        title="Collections"
        description=""
        emptyMessage="None"
        searchLabel="Search collections"
        searchPlaceholder="Enter collection name"
        entries={[]}
        isLoading={false}
        getCount={() => 0}
        getHref={() => "/"}
      />
    </MemoryRouter>
  );
}

describe("CatalogIndexGrid remembered state", () => {
  it("restores this page's remembered search keyword, and only this page's", () => {
    window.sessionStorage.setItem("vgt.view.collections.searchKeyword", JSON.stringify("zelda"));

    const { unmount } = renderGrid("collections");
    expect(screen.getByLabelText("Search collections")).toHaveValue("zelda");
    unmount();

    renderGrid("series");
    expect(screen.getByLabelText("Search collections")).toHaveValue("");
  });
});


describe("CatalogIndexGrid min-games slider", () => {
  it("defaults to more than 2 games and only renders with showMinGamesFilter", () => {
    const entries = [
      { id: 1, name: "Tiny", coverUrls: [] },
      { id: 2, name: "Small", coverUrls: [] },
      { id: 3, name: "Big", coverUrls: [] },
      { id: 4, name: "Huge", coverUrls: [] },
    ];
    const counts: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 9 };

    render(
      <MemoryRouter>
        <CatalogIndexGrid
          stateKey="collections-slider"
          title="Collections"
          description=""
          emptyMessage="None"
          searchLabel="Search collections"
          searchPlaceholder="Enter collection name"
          entries={entries}
          isLoading={false}
          getCount={(entry) => counts[entry.id]}
          getHref={() => "/"}
          showMinGamesFilter
        />
      </MemoryRouter>
    );

    // Default threshold is 2, meaning 2 or more: count 1 is hidden, 2, 3 and 9 show.
    expect(screen.queryByText("Tiny")).not.toBeInTheDocument();
    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByText("Big")).toBeInTheDocument();
    expect(screen.getByText("Huge")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("honours a per-page default of 1, keeping single-game entries", () => {
    const entries = [
      { id: 1, name: "Empty", coverUrls: [] },
      { id: 2, name: "Solo", coverUrls: [] },
    ];
    const counts: Record<number, number> = { 1: 0, 2: 1 };

    render(
      <MemoryRouter>
        <CatalogIndexGrid
          stateKey="platforms-slider"
          title="Platforms"
          description=""
          emptyMessage="None"
          searchLabel="Search platforms"
          searchPlaceholder="Enter platform name"
          entries={entries}
          isLoading={false}
          getCount={(entry) => counts[entry.id]}
          getHref={() => "/"}
          showMinGamesFilter
          minGamesDefault={1}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
  });
});
