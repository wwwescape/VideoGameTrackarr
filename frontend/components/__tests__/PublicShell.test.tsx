import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PublicShell from "../../PublicShell";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <PublicShell />,
        children: [
          { path: "/public/:token/games", element: <div>Games list</div> },
          { path: "/public/:token/games/:gameId", element: <div>A game</div> },
          { path: "/public/:token/hardware", element: <div>Hardware list</div> },
        ],
      },
    ],
    { initialEntries: [path] }
  );
  render(<RouterProvider router={router} />);
}

describe("PublicShell", () => {
  it("has the app name, Games and Hardware tabs and a light/dark button in one header", () => {
    renderAt("/public/tok/hardware");

    const header = screen.getByRole("banner");
    expect(within(header).getByText("VideoGameTrackarr")).toBeInTheDocument();
    const nav = within(header).getByRole("navigation", { name: "Shared collection" });
    expect(within(nav).getByRole("link", { name: "Games" })).toHaveAttribute("href", "/public/tok/games");
    expect(within(nav).getByRole("link", { name: "Hardware" })).toHaveAttribute("aria-current", "page");
    expect(within(header).getByRole("button", { name: /Mode/ })).toBeInTheDocument();
  });

  it("keeps Games selected on a game's own page", () => {
    renderAt("/public/tok/games/42");

    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("A game")).toBeInTheDocument();
  });
});
