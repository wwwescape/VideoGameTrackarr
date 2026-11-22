import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddonLinkCandidate, BaseGameAddons } from "../../api/addonLinks";
import LinkAddonsDialog from "../LinkAddonsDialog";

const candidate = (id: number, name: string, sameCollection: boolean, linked = false) =>
  ({ id, uuid: `u${id}`, slug: null, name, coverUrl: null, firstReleaseDate: 1636070400, sameCollection, linked }) as
    unknown as AddonLinkCandidate;

const CANDIDATES = [
  candidate(2, "Forza Horizon 5: Premium Edition", true, true),
  candidate(3, "Forza Horizon 5: Deluxe Edition", true),
  candidate(4, "Forza Motorsport", false),
];

const BASE: BaseGameAddons = {
  baseGame: { igdbId: 100, name: "Forza Horizon 5", gameId: null },
  addons: [
    { igdbId: 200, name: "FH5 Car Pass", coverUrl: null, category: "dlc_addon", firstReleaseDate: null, gameId: null, linked: false },
    { igdbId: 201, name: "FH5 VIP", coverUrl: null, category: "dlc_addon", firstReleaseDate: null, gameId: 9, linked: true },
  ],
};

const addLinks = { mutateAsync: vi.fn(async () => 2), isPending: false };
const linkBase = {
  mutateAsync: vi.fn(async (ids: number[]) => ids.map((igdbId) => ({ igdbId, status: "linked", gameId: 50 }))),
  isPending: false,
};
const baseQuery = { data: undefined as BaseGameAddons | undefined, isLoading: false, isFetching: false, fetchStatus: "idle" };
vi.mock("../../hooks/useAddonLinks", () => ({
  useAddonLinkCandidates: () => ({ data: CANDIDATES, isLoading: false, isFetching: false }),
  useBaseGameAddons: () => baseQuery,
  useAddAddonLinks: () => addLinks,
  useLinkBaseGameAddons: () => linkBase,
}));

function renderDialog(onClose = vi.fn()) {
  render(<LinkAddonsDialog open gameId={1} gameName="Car Collection" isAddon onClose={onClose} />);
  return { user: userEvent.setup(), onClose };
}

describe("LinkAddonsDialog", () => {
  beforeEach(() => {
    addLinks.mutateAsync.mockClear();
    linkBase.mutateAsync.mockClear();
    baseQuery.data = undefined;
  });

  it("groups candidates by collection, then series, with linked ones ticked and disabled", () => {
    renderDialog();

    expect(screen.getByText("Same collection")).toBeInTheDocument();
    expect(screen.getByText("Same series")).toBeInTheDocument();
    const premium = screen.getByRole("checkbox", { name: "Forza Horizon 5: Premium Edition" });
    expect(premium).toBeChecked();
    expect(premium).toBeDisabled();
    expect(screen.getByText("Already linked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
  });

  it("links every ticked game with one button and closes", async () => {
    const { user, onClose } = renderDialog();

    await user.click(screen.getByText("Forza Horizon 5: Deluxe Edition"));
    await user.click(screen.getByText("Forza Motorsport"));
    await user.click(screen.getByRole("button", { name: "Link 2 games" }));

    expect(addLinks.mutateAsync).toHaveBeenCalledWith([3, 4]);
    expect(onClose).toHaveBeenCalled();
  });

  it("unticks a game on a second click", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByText("Forza Motorsport"));
    expect(screen.getByRole("button", { name: "Link 1 game" })).toBeEnabled();
    await user.click(screen.getByText("Forza Motorsport"));
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
  });

  it("puts the base game's add-ons first on an edition and links both kinds at once", async () => {
    baseQuery.data = BASE;
    const onClose = vi.fn();
    render(
      <LinkAddonsDialog open gameId={1} gameName="FH5 Premium" isAddon={false} offerBaseGameAddons onClose={onClose} />
    );
    const user = userEvent.setup();

    const baseGroup = screen.getByText("From Forza Horizon 5 (IGDB)");
    const collectionGroup = screen.getByText("Same collection");
    expect(baseGroup.compareDocumentPosition(collectionGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Will be added")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "FH5 VIP" })).toBeDisabled();

    await user.click(screen.getByText("FH5 Car Pass"));
    await user.click(screen.getByText("Forza Motorsport"));
    await user.click(screen.getByRole("button", { name: "Link 2 add-ons" }));

    expect(addLinks.mutateAsync).toHaveBeenCalledWith([4]);
    expect(linkBase.mutateAsync).toHaveBeenCalledWith([200]);
    expect(onClose).toHaveBeenCalled();
  });
});
