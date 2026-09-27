import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "../../api/types";
import GameActionButtons from "../GameActionButtons";

const mutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock("../../hooks/useGames", () => ({
  useDeleteGame: () => mutation,
  useResyncGame: () => mutation,
  useClaimDiscoveredGame: () => mutation,
}));

function renderButtons(libraryItems: LibraryItem[] | undefined) {
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

  it("appears below Resync/Remove once an owned copy has a playable ROM", () => {
    renderButtons([ownedWithRom(true)]);

    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Resync Game", "Remove Game", "Play Game"]);
  });
});
