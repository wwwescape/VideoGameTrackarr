import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Breadcrumbs from "../Breadcrumbs";
import { deviceDetailCrumbs, gameDetailCrumbs, gamesCrumbs, hardwareCrumbs } from "../breadcrumbConfig";

vi.mock("../../hooks/useGames", () => ({
  useGame: () => ({ data: { name: "Hollow Knight" } }),
}));

vi.mock("../../hooks/useDevice", () => ({
  useDeviceItem: () => ({ data: { officialName: "PlayStation 5" } }),
}));

const Layout = () => (
  <>
    <Breadcrumbs top={64} left={0} />
    <Outlet />
  </>
);

function renderAt(initialPath: string) {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: "/games", element: <div>Games page</div>, handle: { crumbs: gamesCrumbs } },
          { path: "/game/:identifier", element: <div>Game page</div>, handle: { crumbs: gameDetailCrumbs } },
          { path: "/hardware", element: <div>Hardware page</div>, handle: { crumbs: hardwareCrumbs } },
          {
            path: "/hardware/device/:identifier",
            element: <div>Device detail page</div>,
            handle: { crumbs: deviceDetailCrumbs },
          },
        ],
      },
    ],
    { initialEntries: [initialPath] }
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe("Breadcrumbs", () => {
  it("renders a single, non-link crumb for a top-level route", () => {
    renderAt("/games");

    expect(screen.getByText("Games")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a linked parent crumb and the current page's dynamic name for a detail route", () => {
    renderAt("/game/42");

    const parentLink = screen.getByRole("link", { name: "Games" });
    expect(parentLink).toHaveAttribute("href", "/games");
    expect(screen.getByText("Hollow Knight")).toBeInTheDocument();
  });

  it("shows a loading placeholder for the dynamic crumb until data resolves", () => {
    renderAt("/hardware/device/7");

    expect(screen.getByRole("link", { name: "Hardware" })).toHaveAttribute("href", "/hardware");
    expect(screen.getByText("PlayStation 5")).toBeInTheDocument();
  });

  it("navigates when a parent crumb link is clicked", async () => {
    renderAt("/game/42");

    await userEvent.click(screen.getByRole("link", { name: "Games" }));

    expect(await screen.findByText("Games page")).toBeInTheDocument();
  });
});
