import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSummary } from "../../api/types";
import PackLinksSection from "../PackLinksSection";

const removeFromPack = { mutateAsync: vi.fn(), isPending: false };
const addLinks = { mutateAsync: vi.fn(async () => 1), isPending: false };
const deleteGame = { mutateAsync: vi.fn(async () => undefined), isPending: false };
vi.mock("../../hooks/useAddonLinks", () => ({
  useRemoveFromPack: () => removeFromPack,
  useAddPackLinks: () => addLinks,
}));
vi.mock("../../hooks/useGames", () => ({ useDeleteGame: () => deleteGame }));
// The picker has its own tests.
vi.mock("../PackLinkDialog", () => ({ default: () => null }));

const showUndoToast = vi.fn();
vi.mock("../UndoToast", () => ({ showUndoToast: (...args: unknown[]) => showUndoToast(...args) }));

const HOT_WHEELS = {
  id: 5,
  uuid: "u5",
  slug: "fh5-hot-wheels",
  name: "Hot Wheels",
  coverUrl: null,
  included: true,
} as GameSummary;

function renderSection(isPack: boolean, items: GameSummary[], onCurrentGameDeleted = vi.fn()) {
  render(
    <MemoryRouter>
      <PackLinksSection
        gameId={1}
        gameName={isPack ? "Expansions Bundle" : "Rally Adventure"}
        isPack={isPack}
        items={items}
        onCurrentGameDeleted={onCurrentGameDeleted}
      />
    </MemoryRouter>
  );
  return { user: userEvent.setup(), onCurrentGameDeleted };
}

describe("PackLinksSection", () => {
  beforeEach(() => {
    removeFromPack.mutateAsync.mockReset();
    addLinks.mutateAsync.mockClear();
    deleteGame.mutateAsync.mockClear();
    showUndoToast.mockClear();
  });

  it("invites contents on an empty pack and packs on an add-on", () => {
    renderSection(true, []);
    expect(screen.getByText("Pack contents")).toBeInTheDocument();
    expect(screen.getByText(/A Season Pass or bundle\?/)).toBeInTheDocument();
  });

  it("lists the packs an add-on is in", () => {
    renderSection(false, [{ ...HOT_WHEELS, name: "Expansions Bundle" }]);
    expect(screen.getByText("In packs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Expansions Bundle" })).toHaveAttribute(
      "href",
      "/addon/fh5-hot-wheels"
    );
    expect(screen.getByText("In pack")).toBeInTheDocument();
  });

  it("takes an add-on out of the pack, with Undo putting it back", async () => {
    removeFromPack.mutateAsync.mockResolvedValue(undefined);
    const { user } = renderSection(true, [HOT_WHEELS]);

    await user.click(
      screen.getByRole("button", { name: "Remove Hot Wheels from Expansions Bundle" })
    );

    expect(removeFromPack.mutateAsync).toHaveBeenCalledWith({ packId: 1, addonId: 5 });
    const [, undo] = showUndoToast.mock.calls[0] as [string, () => void];
    undo();
    expect(addLinks.mutateAsync).toHaveBeenCalledWith([5]);
  });

  it("from an add-on, names the pack it leaves", async () => {
    removeFromPack.mutateAsync.mockResolvedValue(undefined);
    const { user } = renderSection(false, [{ ...HOT_WHEELS, id: 9, name: "Expansions Bundle" }]);

    await user.click(
      screen.getByRole("button", { name: "Remove Rally Adventure from Expansions Bundle" })
    );
    expect(removeFromPack.mutateAsync).toHaveBeenCalledWith({ packId: 9, addonId: 1 });
  });

  it("offers to delete an add-on the pack is the last thing holding", async () => {
    removeFromPack.mutateAsync.mockRejectedValue(
      new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: { detail: "last_link_orphan" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      })
    );
    const { user, onCurrentGameDeleted } = renderSection(false, [
      { ...HOT_WHEELS, id: 9, name: "Expansions Bundle" },
    ]);

    await user.click(
      screen.getByRole("button", { name: "Remove Rally Adventure from Expansions Bundle" })
    );
    await user.click(await screen.findByRole("button", { name: "Delete add-on" }));

    expect(deleteGame.mutateAsync).toHaveBeenCalledWith(1);
    await waitFor(() => expect(onCurrentGameDeleted).toHaveBeenCalled());
  });
});
