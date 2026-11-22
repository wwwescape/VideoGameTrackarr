import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackCandidate, PackCandidateGroup } from "../../api/addonLinks";
import PackLinkDialog from "../PackLinkDialog";

const candidate = (id: number, name: string, group: PackCandidateGroup, linked = false) =>
  ({
    id,
    uuid: `u${id}`,
    slug: null,
    name,
    coverUrl: null,
    firstReleaseDate: 1636070400,
    group,
    linked,
  }) as unknown as PackCandidate;

const CANDIDATES = [
  candidate(2, "Hot Wheels", "same_game", true),
  candidate(3, "Rally Adventure", "same_game"),
  candidate(4, "Car Pass", "collection"),
];

const addLinks = { mutateAsync: vi.fn(async () => 2), isPending: false };
vi.mock("../../hooks/useAddonLinks", () => ({
  usePackCandidates: () => ({ data: CANDIDATES, isLoading: false, isFetching: false }),
  useAddPackLinks: () => addLinks,
}));

function renderDialog(isPack = true, onClose = vi.fn()) {
  render(
    <PackLinkDialog
      open
      gameId={1}
      gameName="Expansions Bundle"
      isPack={isPack}
      onClose={onClose}
    />
  );
  return { user: userEvent.setup(), onClose };
}

describe("PackLinkDialog", () => {
  beforeEach(() => addLinks.mutateAsync.mockClear());

  it("groups closest first, with what's already inside ticked and disabled", () => {
    renderDialog();

    expect(screen.getByText("Add to this pack")).toBeInTheDocument();
    const sameGame = screen.getByText("For the same games");
    const collection = screen.getByText("Same collection");
    expect(
      sameGame.compareDocumentPosition(collection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const hotWheels = screen.getByRole("checkbox", { name: "Hot Wheels" });
    expect(hotWheels).toBeChecked();
    expect(hotWheels).toBeDisabled();
    expect(screen.getByText("Already inside")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("adds every ticked add-on with one button and closes", async () => {
    const { user, onClose } = renderDialog();

    await user.click(screen.getByText("Rally Adventure"));
    await user.click(screen.getByText("Car Pass"));
    await user.click(screen.getByRole("button", { name: "Add 2 add-ons" }));

    expect(addLinks.mutateAsync).toHaveBeenCalledWith([3, 4]);
    expect(onClose).toHaveBeenCalled();
  });

  it("from an add-on, picks packs", async () => {
    const { user } = renderDialog(false);

    expect(screen.getByText("Add to packs")).toBeInTheDocument();
    await user.click(screen.getByText("Car Pass"));
    expect(screen.getByRole("button", { name: "Add to 1 pack" })).toBeEnabled();
  });
});
