import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useGame } from "../../hooks/useGames";
import { gameDetailCrumbs } from "../../navigation/breadcrumbConfig";
import NotFoundPage from "../NotFoundPage";
import Page from "../Page";

const getGame = vi.fn(() => Promise.reject(new Error("404")));
vi.mock("../../api/games", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getGame: () => getGame(),
}));

// Shaped like GameDetails: a "Loading" frame until the lookup settles, then the not-found
// page, whose frame is a different element — so the breadcrumb's name label remounts.
const GamePageLike = () => {
  const { identifier } = useParams();
  const { isError } = useGame(identifier);
  if (isError) {
    return <NotFoundPage title="Game not found" message="Gone" actionLabel="Back" actionTo="/" />;
  }
  return <Page>Loading…</Page>;
};

describe("Breadcrumb labels inside the page frame", () => {
  it("don't retry a failed lookup when they remount, so a missing game settles on not found", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter(
      [{ path: "/game/:identifier", element: <GamePageLike />, handle: { crumbs: gameDetailCrumbs } }],
      { initialEntries: ["/game/missing"] }
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Game not found" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(getGame).toHaveBeenCalledTimes(1);
  });
});
