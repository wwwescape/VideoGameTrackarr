import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScreensaverButton from "../ScreensaverButton";

let labOn = true;
vi.mock("../../hooks/useLabs", () => ({
  useEnabledLabs: () => new Set(labOn ? ["screensaver"] : []),
}));
vi.mock("../Screensaver", () => ({ default: () => <div>Screensaver overlay</div> }));
vi.mock("../../api/screensaver", () => ({ getScreensaverSample: vi.fn().mockResolvedValue({ games: [], total: 0 }) }));

function renderShell(initialEntries: Array<string | { pathname: string; state: unknown }> = ["/games"]) {
  const router = createMemoryRouter(
    [{ path: "*", element: <ScreensaverButton /> }],
    { initialEntries, initialIndex: initialEntries.length - 1 }
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return router;
}

describe("ScreensaverButton", () => {
  beforeEach(() => {
    labOn = true;
  });

  it("isn't there while the lab is off", () => {
    labOn = false;
    renderShell();
    expect(screen.queryByRole("button", { name: "Start screensaver" })).not.toBeInTheDocument();
  });

  it("opens the screensaver on a new history entry, and Back closes it", async () => {
    const router = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Start screensaver" }));

    expect(await screen.findByText("Screensaver overlay")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start screensaver" })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/games");
    expect(router.state.historyAction).toBe("PUSH");

    await act(() => router.navigate(-1));
    expect(screen.queryByText("Screensaver overlay")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start screensaver" })).toBeInTheDocument();
  });

  it("stays closed on an entry from before a reload", () => {
    // History kept the entry's state, but this page load never handed out its token.
    renderShell(["/games", { pathname: "/games", state: { screensaver: "from-before-reload" } }]);
    expect(screen.queryByText("Screensaver overlay")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start screensaver" })).toBeInTheDocument();
  });

  it("keeps the page's own history state when opening", async () => {
    const router = renderShell([{ pathname: "/games", state: { from: "overview" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Start screensaver" }));
    await screen.findByText("Screensaver overlay");
    expect(router.state.location.state).toMatchObject({ from: "overview", screensaver: expect.any(String) });
  });
});
