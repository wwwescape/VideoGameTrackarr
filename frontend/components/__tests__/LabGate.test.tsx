import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withLab } from "../LabGate";

let labs: {
  data?: { id: string; enabled: boolean }[];
  isError: boolean;
  isFetchedAfterMount: boolean;
  fetchStatus: "idle" | "fetching" | "paused";
};
vi.mock("../../hooks/useLabs", () => ({ useLabs: () => labs }));

const Shelf = withLab("game_shelf", () => <div>Shelf page</div>);

function renderGate() {
  const router = createMemoryRouter(
    [
      { path: "/games/shelf", element: <Shelf /> },
      { path: "/settings/labs", element: <div>Labs page</div> },
    ],
    { initialEntries: ["/games/shelf"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("withLab", () => {
  beforeEach(() => {
    labs = {
      data: [{ id: "game_shelf", enabled: true }],
      isError: false,
      isFetchedAfterMount: true,
      fetchStatus: "idle",
    };
  });

  it("shows the page while its lab is on", () => {
    renderGate();
    expect(screen.getByText("Shelf page")).toBeInTheDocument();
  });

  it("sends you to Labs while it's off", () => {
    labs.data = [{ id: "game_shelf", enabled: false }];
    const router = renderGate();
    expect(router.state.location.pathname).toBe("/settings/labs");
  });

  it("waits for a fresh answer rather than trusting the remembered one", () => {
    // Remembered from before the lab was turned on, and refetching now.
    labs = {
      data: [{ id: "game_shelf", enabled: false }],
      isError: false,
      isFetchedAfterMount: false,
      fetchStatus: "fetching",
    };
    const router = renderGate();
    expect(router.state.location.pathname).toBe("/games/shelf");
    expect(screen.queryByText("Shelf page")).not.toBeInTheDocument();
  });

  it("uses the remembered answer while offline", () => {
    labs = {
      data: [{ id: "game_shelf", enabled: true }],
      isError: false,
      isFetchedAfterMount: false,
      fetchStatus: "paused",
    };
    renderGate();
    expect(screen.getByText("Shelf page")).toBeInTheDocument();
  });
});
