import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  deviceDetailCrumbs,
  gameDetailCrumbs,
  gamesCrumbs,
  hardwareCrumbs,
} from "../../navigation/breadcrumbConfig";
import Page, { ToolbarButton } from "../Page";
import SettingsFrame from "../SettingsFrame";

vi.mock("../../hooks/useGames", () => ({
  useGame: () => ({ data: { name: "Hollow Knight" } }),
}));

vi.mock("../../hooks/useDevice", () => ({
  useDeviceItem: () => ({ data: { officialName: "PlayStation 5" } }),
}));

// Pages render their own frame; wrapping the outlet here gives every test route one that
// takes its crumbs from the route, as the real pages do.
const Layout = () => (
  <Page>
    <Outlet />
  </Page>
);

function renderAt(initialPath: string) {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: "/games", element: <div>Games page</div>, handle: { crumbs: gamesCrumbs } },
          {
            path: "/game/:identifier",
            element: <div>Game page</div>,
            handle: { crumbs: gameDetailCrumbs },
          },
          {
            path: "/hardware",
            element: <div>Hardware page</div>,
            handle: { crumbs: hardwareCrumbs },
          },
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

describe("Page breadcrumbs", () => {
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

describe("Page toolbar", () => {
  it("shows its actions as labelled buttons and links, with the meta after the crumbs", async () => {
    const onAdd = vi.fn();
    render(
      <MemoryRouter initialEntries={["/settings/jobs"]}>
        <Page
          crumbs={[{ label: "Games" }]}
          meta="224 games"
          toolbar={
            <>
              <ToolbarButton icon={<span />} label="Add game" primary onClick={onAdd} />
              <ToolbarButton icon={<span />} label="Jobs" to="/settings/jobs" active />
            </>
          }
        />
      </MemoryRouter>
    );

    const toolbar = screen.getByRole("toolbar");
    await userEvent.click(within(toolbar).getByRole("button", { name: "Add game" }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(within(toolbar).getByRole("link", { name: "Jobs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1, name: "Games" })).toBeInTheDocument();
    expect(screen.getByText("224 games")).toBeInTheDocument();
  });

  it("gives every Settings page its sub-pages as tabs, the current one marked", () => {
    render(
      <MemoryRouter initialEntries={["/settings/emulation"]}>
        <SettingsFrame description="BIOS files and cores.">
          <div />
        </SettingsFrame>
      </MemoryRouter>
    );

    const toolbar = screen.getByRole("toolbar");
    expect(within(toolbar).getAllByRole("link")).toHaveLength(8);
    expect(within(toolbar).getByRole("link", { name: "General" })).toHaveAttribute("href", "/settings");
    expect(within(toolbar).getByRole("link", { name: "Emulation" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("BIOS files and cores.")).toBeInTheDocument();
  });
});
