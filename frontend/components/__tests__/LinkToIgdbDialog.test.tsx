import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LinkToIgdbDialog from "../LinkToIgdbDialog";

const mutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock("../../hooks/useGames", () => ({
  useGames: () => ({ data: [] }),
  useLinkGameToIgdb: () => mutation,
  useLinkGameToIgdbViaParent: () => mutation,
  useMergeGameIntoIgdb: () => mutation,
}));
vi.mock("../../hooks/useIgdbSearch", () => ({ useIgdbSearch: () => ({ data: [], isFetching: false, error: null }) }));

const renderDialog = (changing: boolean) =>
  render(
    <MemoryRouter>
      <LinkToIgdbDialog open gameId={1} gameName="Stage Tour" gameCategory="main_game" changing={changing} onClose={vi.fn()} />
    </MemoryRouter>
  );

describe("LinkToIgdbDialog", () => {
  it("links a custom game without a warning", () => {
    renderDialog(false);

    expect(screen.getByRole("heading", { name: "Link to IGDB" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("changes the link with the same flow, warning that the current add-ons go", () => {
    renderDialog(true);

    expect(screen.getByRole("heading", { name: "Change IGDB link" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Its current add-ons from IGDB are removed");
    // Same search as Link to IGDB, starting from the game's name.
    expect(screen.getByDisplayValue("Stage Tour")).toBeInTheDocument();
  });
});
