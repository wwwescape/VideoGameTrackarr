import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import GlobalSearch, { useSearchHandoff } from "../GlobalSearch";
import { useState } from "react";

vi.mock("../../hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));
vi.mock("../../hooks/useGames", () => ({
  useGames: (filters: { search?: string }, options?: { enabled?: boolean }) => ({
    data:
      options?.enabled && filters.search
        ? [{ id: 1, uuid: "u1", slug: "zelda-botw", name: "Zelda: Breath of the Wild", coverUrl: null, firstReleaseDate: 1488499200 }]
        : undefined,
  }),
}));
// The smaller lists only return data once GlobalSearch enables them, like the real hooks.
const listEnabled = vi.hoisted(() => vi.fn());
const enabledList = <T,>(name: string, data: T[], options?: { enabled?: boolean }) => {
  listEnabled(name, options?.enabled ?? true);
  return { data: options?.enabled === false ? undefined : data };
};
vi.mock("../../hooks/useDevice", () => ({
  useDeviceList: (_params: unknown, options?: { enabled?: boolean }) =>
    enabledList(
      "devices",
      [{ id: 5, uuid: "d5", officialName: "Nintendo Switch", hardwarePlatformName: "Switch", manufacturerName: "Nintendo" }],
      options
    ),
}));
vi.mock("../../hooks/useAccessories", () => ({
  useAccessoryList: (_params: unknown, options?: { enabled?: boolean }) => enabledList("accessories", [], options),
}));
vi.mock("../../hooks/useCatalogBrowse", () => ({
  useFranchises: (options?: { enabled?: boolean }) =>
    enabledList("franchises", [{ id: 7, name: "The Legend of Zelda", slug: "zelda" }], options),
  useCollections: (options?: { enabled?: boolean }) => enabledList("collections", [], options),
}));

const Shows = ({ label }: { label: string }) => {
  const location = useLocation();
  return (
    <div>
      {label} {JSON.stringify(location.state)}
    </div>
  );
};

// What the Games list does with a hand-off: applies it, then the history entry no longer
// carries it.
const GamesStub = () => {
  const [applied, setApplied] = useState("");
  useSearchHandoff("search", setApplied);
  return <Shows label={`Games page, search=${applied}`} />;
};

function renderSearch() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <>
            <GlobalSearch />
            <Shows label="Home" />
          </>
        ),
      },
      { path: "/games", element: <GamesStub /> },
      { path: "/games/add", element: <Shows label="Add game" /> },
      { path: "/game/:identifier", element: <Shows label="Game page" /> },
      { path: "/games/series/:slug", element: <Shows label="Series page" /> },
    ],
    { initialEntries: ["/"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("GlobalSearch", () => {
  it("lists matching games, hardware and series, and opens the one picked", async () => {
    const router = renderSearch();
    await userEvent.type(screen.getByRole("combobox", { name: "Search" }), "zel");

    expect(await screen.findByText("Zelda: Breath of the Wild")).toBeInTheDocument();
    expect(screen.getByText("The Legend of Zelda")).toBeInTheDocument();
    expect(screen.queryByText("Nintendo Switch")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Zelda: Breath of the Wild"));
    expect(router.state.location.pathname).toBe("/game/zelda-botw");
  });

  it("filters the Games list by the text on Enter, applying it once", async () => {
    const router = renderSearch();
    await userEvent.type(screen.getByRole("combobox", { name: "Search" }), "metroid{Enter}");

    expect(await screen.findByText(/Games page, search=metroid/)).toBeInTheDocument();
    // The hand-off is dropped from history once applied.
    expect(router.state.location.state).toBeNull();
  });

  it("hands the text to Add Game's IGDB search", async () => {
    const router = renderSearch();
    await userEvent.type(screen.getByRole("combobox", { name: "Search" }), "hades");
    await userEvent.click(await screen.findByText("Search IGDB for “hades”"));

    expect(router.state.location.pathname).toBe("/games/add");
    expect(router.state.location.state).toEqual({ igdbSearch: "hades" });
  });

  it("loads the hardware, series and collection lists only once the box gets focus", async () => {
    listEnabled.mockClear();
    renderSearch();
    expect(listEnabled).toHaveBeenCalled();
    expect(listEnabled.mock.calls.every(([, enabled]) => enabled === false)).toBe(true);

    listEnabled.mockClear();
    await userEvent.click(screen.getByRole("combobox", { name: "Search" }));
    for (const name of ["devices", "accessories", "franchises", "collections"]) {
      expect(listEnabled).toHaveBeenCalledWith(name, true);
    }
  });

  it("focuses on / from anywhere but a text field", async () => {
    renderSearch();
    await userEvent.keyboard("/");

    expect(screen.getByRole("combobox", { name: "Search" })).toHaveFocus();
  });
});
