import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScreensaverSettingsPage from "../ScreensaverSettingsPage";

let labOn = true;
let saveFailed = false;
const mutate = vi.fn();
vi.mock("../../hooks/useLabs", () => ({
  useLabs: () => ({
    data: [{ id: "screensaver", enabled: labOn }],
    isError: false,
    isFetchedAfterMount: true,
    fetchStatus: "idle",
  }),
  useEnabledLabs: () => new Set(labOn ? ["screensaver"] : []),
}));
vi.mock("../../hooks/useScreensaver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useScreensaver")>()),
  useScreensaverInterval: () => ({ seconds: 8, save: { mutate, isError: saveFailed } }),
  useScreensaverShows: () => ({ shows, save: { mutate: saveShows, isError: false, isPending: false } }),
}));
let shows = { owned: true, wishlist: false, custom: true };
const saveShows = vi.fn();
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
      { path: "/settings/screensaver", element: <ScreensaverSettingsPage /> },
      { path: "/settings/labs", element: <div>Labs page</div> },
    ],
    { initialEntries: ["/settings/screensaver"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("Settings → Screensaver", () => {
  beforeEach(() => {
    labOn = true;
    saveFailed = false;
    mutate.mockReset();
    saveShows.mockReset();
    shows = { owned: true, wishlist: false, custom: true };
  });

  it("shows the time per cover, 5 to 15 seconds", () => {
    renderPage();
    const slider = screen.getByRole("slider", { name: "Time per cover" });
    expect(slider).toHaveValue("8");
    expect(slider).toHaveAttribute("min", "5");
    expect(slider).toHaveAttribute("max", "15");
    expect(screen.getByText("Each cover shows for 8 seconds.")).toBeInTheDocument();
    expect(screen.getByText(/Hide a game from the screensaver on its page/)).toBeInTheDocument();
  });

  it("saves a new time once, when it's let go", () => {
    renderPage();
    const slider = screen.getByRole("slider", { name: "Time per cover" });
    fireEvent.change(slider, { target: { value: "12" } });
    expect(screen.getByText("Each cover shows for 12 seconds.")).toBeInTheDocument();
    fireEvent.mouseUp(slider);
    fireEvent.keyUp(slider);
    // MUI commits on pointer/key up of the thumb; a keyboard change commits straight away.
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(mutate).toHaveBeenLastCalledWith(13);
  });

  it("says when saving failed", () => {
    saveFailed = true;
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save that change");
  });

  it("goes to Labs while the lab is off", () => {
    labOn = false;
    const router = renderPage();
    expect(router.state.location.pathname).toBe("/settings/labs");
  });

  it("chooses what to show, keeping at least owned or wishlisted on", async () => {
    renderPage();
    const owned = screen.getByRole("switch", { name: "Games I own" });
    const wishlist = screen.getByRole("switch", { name: "Games on my wishlist" });
    expect(owned).toBeChecked();
    // The only one on can't be turned off.
    expect(owned).toBeDisabled();
    expect(screen.getByText(/needs something to show/)).toBeInTheDocument();
    expect(wishlist).not.toBeChecked();

    fireEvent.click(wishlist);
    expect(saveShows).toHaveBeenCalledWith({ wishlist: true });

    fireEvent.click(screen.getByRole("switch", { name: "Include custom games" }));
    expect(saveShows).toHaveBeenLastCalledWith({ custom: false });
  });

  it("lets owned go once the wishlist is on", () => {
    shows = { owned: true, wishlist: true, custom: true };
    renderPage();
    const owned = screen.getByRole("switch", { name: "Games I own" });
    expect(owned).toBeEnabled();
    fireEvent.click(owned);
    expect(saveShows).toHaveBeenCalledWith({ owned: false });
  });
});
