import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
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
