import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "../../api/types";
import GameActionButtons from "../GameActionButtons";

const mutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock("../../hooks/useGames", () => ({
  useDeleteGame: () => mutation,
  useResyncGame: () => mutation,
  useClaimDiscoveredGame: () => mutation,
  useUnlinkGameFromIgdb: () => mutation,
}));

// Only rendered for custom games; its own hooks aren't what these tests are about.
vi.mock("../LinkToIgdbDialog", () => ({ default: () => null }));

function renderButtons(libraryItems: LibraryItem[] | undefined, linkedFromCustom = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <GameActionButtons
          gameId={1}
          gameIdentifier="mario"
          gameName="Mario"
          gameCategory="main_game"
          hasParentGame={false}
          hasIgdbId
          linkedFromCustom={linkedFromCustom}
          resyncGameId={1}
          isAutoDiscovered={false}
          libraryItems={libraryItems}
          onGameRemoved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const ownedWithRom = (playable: boolean) =>
  ({
    id: 1,
    status: "owned",
    platformName: "NES",
    roms: [
      {
        id: 1,
        originalFilename: "game.nes",
        sizeBytes: 1024,
        extension: "nes",
        isArchive: false,
        playable,
        core: playable ? "fceumm" : null,
        unplayableReason: playable ? null : "unsupported_platform",
      },
    ],
  }) as unknown as LibraryItem;

describe("GameActionButtons Play Game", () => {
  it("is hidden without a playable ROM", () => {
    renderButtons(undefined);
    expect(screen.queryByRole("button", { name: "Play Game" })).not.toBeInTheDocument();

    renderButtons([ownedWithRom(false)]);
    expect(screen.queryByRole("button", { name: "Play Game" })).not.toBeInTheDocument();
  });

  it("leads the toolbar once an owned copy has a playable ROM, with Remove kept at the far end", () => {
    renderButtons([ownedWithRom(true)]);

    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Play Game", "Resync Game", "Remove Game"]);
  });
});

describe("GameActionButtons Edit", () => {
  it("opens a custom game's edit page marked as coming from its page, so saving steps back", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/game/:id",
          element: (
            <GameActionButtons
              gameId={1}
              gameIdentifier="my-homebrew-uuid1"
              gameName="My Homebrew"
              gameCategory="main_game"
              hasParentGame={false}
              hasIgdbId={false}
              linkedFromCustom={false}
              resyncGameId={1}
              isAutoDiscovered={false}
              onGameRemoved={vi.fn()}
            />
          ),
        },
        { path: "/game/:id/edit", element: <div>Edit page</div> },
      ],
      { initialEntries: ["/game/my-homebrew-uuid1"] }
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Game" }));

    expect(router.state.location.pathname).toBe("/game/my-homebrew-uuid1/edit");
    expect(router.state.location.state).toEqual({ fromDetail: true });
  });
});

describe("GameActionButtons IGDB link", () => {
  it("offers Change IGDB link and Unlink only for a game that was linked from custom", () => {
    renderButtons(undefined);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Resync Game", "Remove Game"]);
  });

  it("asks before unlinking, warning that the add-ons go", async () => {
    mutation.mutateAsync.mockClear().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderButtons(undefined, true);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Resync Game",
      "Change IGDB link",
      "Unlink from IGDB",
      "Remove Game",
    ]);
    await user.click(screen.getByRole("button", { name: "Unlink from IGDB" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Mario becomes a custom game again");
    expect(dialog).toHaveTextContent("add-ons from IGDB are removed");
    expect(mutation.mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(mutation.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
