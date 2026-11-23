import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddonLinkCandidate, BaseGameAddons } from "../../api/addonLinks";
import LinkAddonsDialog from "../LinkAddonsDialog";

const STANDARD = { id: 10, uuid: "u10", slug: null, name: "Forza Horizon 5" };
const DELUXE = { id: 11, uuid: "u11", slug: null, name: "Forza Horizon 5: Deluxe Edition" };

const candidate = (id: number, name: string, edition: typeof STANDARD | null, linked = false) =>
  ({
    id,
    uuid: `u${id}`,
    slug: null,
    name,
    coverUrl: null,
    firstReleaseDate: 1636070400,
    edition,
    linked,
    linkedRelation: "works_with",
  }) as unknown as AddonLinkCandidate;

// From an add-on: the other editions of its game (no edition of their own).
const CANDIDATES = [
  candidate(2, "Forza Horizon 5: Premium Edition", null, true),
  candidate(3, "Forza Horizon 5: Deluxe Edition", null),
  candidate(4, "Forza Horizon 5: Standard Edition", null),
];
// From a game: the other editions' add-ons, by edition.
const ADDON_CANDIDATES = [
  candidate(5, "Car Pass", STANDARD),
  candidate(6, "Hot Wheels", STANDARD),
  candidate(7, "VIP", DELUXE),
];
const candidatesQuery = { data: CANDIDATES, isLoading: false, isFetching: false };

const BASE: BaseGameAddons = {
  baseGame: { igdbId: 100, name: "Forza Horizon 5", gameId: null },
  addons: [
    {
      igdbId: 200,
      name: "FH5 Car Pass",
      coverUrl: null,
      category: "dlc_addon",
      firstReleaseDate: null,
      gameId: null,
      linked: false,
      relation: "works_with",
      suggestedIncluded: true,
    },
    {
      igdbId: 201,
      name: "FH5 VIP",
      coverUrl: null,
      category: "dlc_addon",
      firstReleaseDate: null,
      gameId: 9,
      linked: true,
      relation: "works_with",
      suggestedIncluded: false,
    },
  ],
};

const addLinks = { mutateAsync: vi.fn(async () => 2), isPending: false };
const linkBase = {
  mutateAsync: vi.fn(async ({ igdbIds }: { igdbIds: number[] }) =>
    igdbIds.map((igdbId) => ({ igdbId, status: "linked", gameId: 50 }))
  ),
  isPending: false,
};
const baseQuery = {
  data: undefined as BaseGameAddons | undefined,
  isLoading: false,
  isFetching: false,
  fetchStatus: "idle",
};
vi.mock("../../hooks/useAddonLinks", () => ({
  useAddonLinkCandidates: () => candidatesQuery,
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
    candidatesQuery.data = CANDIDATES;
  });

  it("lists the other editions, with linked ones ticked and disabled", () => {
    renderDialog();

    expect(screen.getByText("Other editions")).toBeInTheDocument();
    const premium = screen.getByRole("checkbox", { name: "Forza Horizon 5: Premium Edition" });
    expect(premium).toBeChecked();
    expect(premium).toBeDisabled();
    expect(screen.getByText("Already linked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
  });

  it("links every ticked game with one button and closes", async () => {
    const { user, onClose } = renderDialog();

    await user.click(screen.getByText("Forza Horizon 5: Deluxe Edition"));
    await user.click(screen.getByText("Forza Horizon 5: Standard Edition"));
    await user.click(screen.getByRole("button", { name: "Link 2 games" }));

    expect(addLinks.mutateAsync).toHaveBeenCalledWith({
      ids: [3, 4],
      includedIds: [],
      preorderBonusIds: [],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("unticks a game on a second click", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByText("Forza Horizon 5: Standard Edition"));
    expect(screen.getByRole("button", { name: "Link 1 game" })).toBeEnabled();
    await user.click(screen.getByText("Forza Horizon 5: Standard Edition"));
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
  });

  it("puts the base game's add-ons first on an edition, then add-ons by edition", async () => {
    baseQuery.data = BASE;
    candidatesQuery.data = ADDON_CANDIDATES;
    const onClose = vi.fn();
    render(
      <LinkAddonsDialog
        open
        gameId={1}
        gameName="FH5 Premium"
        isAddon={false}
        offerBaseGameAddons
        onClose={onClose}
      />
    );
    const user = userEvent.setup();

    const baseGroup = screen.getByText("From Forza Horizon 5 (IGDB)");
    const standardGroup = screen.getByText("Forza Horizon 5");
    const deluxeGroup = screen.getByText("Forza Horizon 5: Deluxe Edition");
    expect(
      baseGroup.compareDocumentPosition(standardGroup) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      standardGroup.compareDocumentPosition(deluxeGroup) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText("Will be added")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "FH5 VIP" })).toBeDisabled();

    await user.click(screen.getByText("FH5 Car Pass"));
    await user.click(screen.getByText("Hot Wheels"));
    await user.click(screen.getByRole("button", { name: "Link 2 add-ons" }));

    expect(addLinks.mutateAsync).toHaveBeenCalledWith({
      ids: [6],
      includedIds: [],
      preorderBonusIds: [],
    });
    // IGDB lists Car Pass in this edition's bundle, so it starts as Included.
    expect(linkBase.mutateAsync).toHaveBeenCalledWith({
      igdbIds: [200],
      includedIds: [200],
      preorderBonusIds: [],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("clears the search with the × button", async () => {
    const { user } = renderDialog();
    const search = screen.getByRole("textbox", { name: "Search" });

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    await user.type(search, "deluxe");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(search).toHaveValue("");
  });

  it("links ticked games as Included or as a pre-order bonus when chosen", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByText("Forza Horizon 5: Deluxe Edition"));
    await user.click(screen.getByText("Forza Horizon 5: Standard Edition"));
    // Each ticked row offers Works with | Included | Pre-order bonus; Works with is the default.
    const included = screen.getAllByRole("button", { name: "Included" });
    const bonus = screen.getAllByRole("button", { name: "Pre-order bonus" });
    expect(included).toHaveLength(2);
    await user.click(included[0]);
    await user.click(bonus[1]);
    await user.click(screen.getByRole("button", { name: "Link 2 games" }));

    expect(addLinks.mutateAsync).toHaveBeenCalledWith({
      ids: [3, 4],
      includedIds: [3],
      preorderBonusIds: [4],
    });
  });
});
