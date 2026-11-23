import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackCandidate } from "../../api/addonLinks";
import PackLinkDialog from "../PackLinkDialog";

const STANDARD = { id: 10, uuid: "u10", slug: null, name: "Forza Horizon 5" };
const PREMIUM = { id: 11, uuid: "u11", slug: null, name: "Forza Horizon 5: Premium Edition" };

const candidate = (id: number, name: string, edition: typeof STANDARD, linked = false) =>
  ({
    id,
    uuid: `u${id}`,
    slug: null,
    name,
    coverUrl: null,
    firstReleaseDate: 1636070400,
    edition,
    linked,
  }) as unknown as PackCandidate;

const CANDIDATES = [
  candidate(2, "Hot Wheels", STANDARD, true),
  candidate(3, "Rally Adventure", STANDARD),
  candidate(4, "Car Pass", PREMIUM),
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

  it("groups by edition, with what's already inside ticked and disabled", () => {
    renderDialog();

    expect(screen.getByText("Add to this pack")).toBeInTheDocument();
    const sameGame = screen.getByText("Forza Horizon 5");
    const collection = screen.getByText("Forza Horizon 5: Premium Edition");
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
