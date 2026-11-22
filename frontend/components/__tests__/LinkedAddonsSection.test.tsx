import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSummary } from "../../api/types";
import LinkedAddonsSection from "../LinkedAddonsSection";

const removeLink = { mutateAsync: vi.fn(), isPending: false };
const addLinks = { mutateAsync: vi.fn(async () => 1), isPending: false };
const deleteGame = { mutateAsync: vi.fn(async () => undefined), isPending: false };
const setIncluded = { mutateAsync: vi.fn(async () => undefined), isPending: false };
vi.mock("../../hooks/useAddonLinks", () => ({
  useRemoveAddonLink: () => removeLink,
  useAddAddonLinks: () => addLinks,
  useSetAddonIncluded: () => setIncluded,
}));
vi.mock("../../hooks/useGames", () => ({ useDeleteGame: () => deleteGame }));
// The picker has its own tests.
vi.mock("../LinkAddonsDialog", () => ({ default: () => null }));

const showUndoToast = vi.fn();
vi.mock("../UndoToast", () => ({ showUndoToast: (...args: unknown[]) => showUndoToast(...args) }));

const PREMIUM = {
  id: 2,
  uuid: "u2",
  slug: "fh5-premium",
  name: "Forza Horizon 5: Premium Edition",
  coverUrl: null,
  manualLink: true,
  included: false,
} as GameSummary;
// The add-on's own IGDB parent: listed so it can be marked Included, but not unlinkable.
const STANDARD = {
  id: 3,
  uuid: "u3",
  slug: "fh5",
  name: "Forza Horizon 5",
  coverUrl: null,
  manualLink: false,
} as GameSummary;

function renderSection(links: GameSummary[] = [PREMIUM], onCurrentGameDeleted = vi.fn()) {
  render(
    <MemoryRouter>
      <LinkedAddonsSection
        gameId={1}
        gameName="Car Collection"
        isAddon
        links={links}
        onCurrentGameDeleted={onCurrentGameDeleted}
      />
    </MemoryRouter>
  );
  return { user: userEvent.setup(), onCurrentGameDeleted };
}

const conflict = (detail: string) =>
  new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 409,
    statusText: "Conflict",
    data: { detail },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("LinkedAddonsSection", () => {
  beforeEach(() => {
    removeLink.mutateAsync.mockReset();
    addLinks.mutateAsync.mockClear();
    deleteGame.mutateAsync.mockClear();
    showUndoToast.mockClear();
    setIncluded.mutateAsync.mockClear();
  });

  it("invites a link when there are none", () => {
    renderSection([]);

    expect(screen.getByText("Linked games")).toBeInTheDocument();
    expect(
      screen.getByText("Works with another edition or version too? Link it here.")
    ).toBeInTheDocument();
  });

  it("lists linked games as links to their pages", () => {
    renderSection();

    expect(screen.getByRole("link", { name: "Forza Horizon 5: Premium Edition" })).toHaveAttribute(
      "href",
      "/game/fh5-premium"
    );
  });

  it("unlinks straight away and offers Undo, which links it again", async () => {
    removeLink.mutateAsync.mockResolvedValue(undefined);
    const { user } = renderSection();

    await user.click(
      screen.getByRole("button", { name: "Unlink Forza Horizon 5: Premium Edition" })
    );

    expect(removeLink.mutateAsync).toHaveBeenCalledWith(2);
    expect(showUndoToast).toHaveBeenCalledWith(
      "Unlinked Forza Horizon 5: Premium Edition",
      expect.any(Function),
      5000
    );
    const undo = showUndoToast.mock.calls[0][1] as () => void;
    undo();
    expect(addLinks.mutateAsync).toHaveBeenCalledWith({ ids: [2], includedIds: [] });
  });

  it("offers to delete an add-on whose last link can't be removed", async () => {
    removeLink.mutateAsync.mockRejectedValue(conflict("last_link_orphan"));
    const { user, onCurrentGameDeleted } = renderSection();

    await user.click(
      screen.getByRole("button", { name: "Unlink Forza Horizon 5: Premium Edition" })
    );
    expect(await screen.findByText("Delete this add-on?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete add-on" }));

    expect(deleteGame.mutateAsync).toHaveBeenCalledWith(1);
    await waitFor(() => expect(onCurrentGameDeleted).toHaveBeenCalled());
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  it("marks a linked game as Included in one click", async () => {
    const { user } = renderSection();

    const toggle = screen.getByRole("button", {
      name: "Car Collection included in Forza Horizon 5: Premium Edition",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(setIncluded.mutateAsync).toHaveBeenCalledWith({ otherId: 2, included: true });
  });

  it("lists the IGDB parent with an Included toggle but no unlink", () => {
    renderSection([STANDARD, PREMIUM]);

    expect(screen.getByText("From IGDB")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Car Collection included in Forza Horizon 5" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlink Forza Horizon 5" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unlink Forza Horizon 5: Premium Edition" })
    ).toBeInTheDocument();
  });
});
