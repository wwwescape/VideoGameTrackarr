import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tag } from "../../api/types";
import { buildGameFilterParams } from "../../api/games";
import GameFilterDialog from "../GameFilterDialog";

const tags: Tag[] = [
  { id: 1, name: "Roguelike", color: null, textColor: null },
  { id: 2, name: "Metroidvania", color: null, textColor: null },
];

function renderToolbar(overrides: Partial<ComponentProps<typeof GameFilterDialog>> = {}) {
  const props: ComponentProps<typeof GameFilterDialog> = {
    open: true,
    onClose: vi.fn(),
    ownershipStatuses: [],
    onOwnershipStatusesChange: vi.fn(),
    ownershipExclude: false,
    onOwnershipExcludeChange: vi.fn(),
    platformOptions: [],
    platformKeys: [],
    onPlatformKeysChange: vi.fn(),
    platformExclude: false,
    onPlatformExcludeChange: vi.fn(),
    tagOptions: tags,
    tagIds: [],
    onTagIdsChange: vi.fn(),
    tagExclude: false,
    onTagExcludeChange: vi.fn(),
    collectionOptions: [],
    collectionIds: [],
    onCollectionIdsChange: vi.fn(),
    collectionExclude: false,
    onCollectionExcludeChange: vi.fn(),
    franchiseOptions: [],
    franchiseIds: [],
    onFranchiseIdsChange: vi.fn(),
    franchiseExclude: false,
    onFranchiseExcludeChange: vi.fn(),
    gameTypes: [],
    onGameTypesChange: vi.fn(),
    gameTypeExclude: false,
    onGameTypeExcludeChange: vi.fn(),
    formats: [],
    onFormatsChange: vi.fn(),
    formatExclude: false,
    onFormatExcludeChange: vi.fn(),
    storefrontOptions: [],
    storefronts: [],
    onStorefrontsChange: vi.fn(),
    storefrontExclude: false,
    onStorefrontExcludeChange: vi.fn(),
    playStatuses: [],
    onPlayStatusesChange: vi.fn(),
    playStatusExclude: false,
    onPlayStatusExcludeChange: vi.fn(),
    matchAll: {},
    onMatchAllChange: vi.fn(),
    genreOptions: [],
    genreIds: [],
    onGenreIdsChange: vi.fn(),
    genreExclude: false,
    onGenreExcludeChange: vi.fn(),
    releaseStatuses: [],
    onReleaseStatusesChange: vi.fn(),
    releaseYearFrom: null,
    onReleaseYearFromChange: vi.fn(),
    releaseYearTo: null,
    onReleaseYearToChange: vi.fn(),
    localPlayersMin: null,
    onLocalPlayersMinChange: vi.fn(),
    onlineMultiplayerOnly: false,
    onOnlineMultiplayerOnlyChange: vi.fn(),
    coopOnly: false,
    onCoopOnlyChange: vi.fn(),
    timeToBeat: null,
    onTimeToBeatChange: vi.fn(),
    ratingMin: null,
    onRatingMinChange: vi.fn(),
    ...overrides,
  };
  render(<GameFilterDialog {...props} />);
  return props;
}

// The dialog renders open; the page's Filter button is what opens it (see GameListControls).
async function openFilters() {
  const user = userEvent.setup();
  return { user, dialog: await screen.findByRole("dialog") };
}

// Filter tab order is Game Types, Tags, Ownership, ... and Game Types has no match toggle,
// so the Tags field's toggle is the first one.
const TAGS_GROUP = 0;

describe("GameFilterDialog match mode", () => {
  it("keeps the toggle disabled until two values are picked", async () => {
    renderToolbar({ tagIds: [1] });
    const { dialog } = await openFilters();

    const groups = within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" });
    const tagToggle = within(groups[TAGS_GROUP]).getByRole("button", { name: "Match all" });
    expect(tagToggle).toBeDisabled();
  });

  it("switches a field to Match all without touching the others", async () => {
    const props = renderToolbar({ tagIds: [1, 2], matchAll: { platform: true } });
    const { user, dialog } = await openFilters();

    const groups = within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" });
    await user.click(within(groups[TAGS_GROUP]).getByRole("button", { name: "Match all" }));

    expect(props.onMatchAllChange).toHaveBeenCalledWith({ platform: true, tag: true });
  });

  it("offers no match toggle for Game Types", async () => {
    renderToolbar({ gameTypes: ["main_game", "bundle"] });
    const { dialog } = await openFilters();

    // One toggle per field except Game Types: Tags, Ownership, Play Status, Platforms,
    // Formats, Collections, Series, Genres (Storefront only shows once Digital is picked).
    expect(within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" })).toHaveLength(8);
  });

  it("lists the play statuses, including Not started", async () => {
    renderToolbar();
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("combobox", { name: "Play Status" }));

    for (const label of ["Not started", "Backlog", "Playing", "Completed", "Abandoned"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("clears play statuses and match modes with Clear filters", async () => {
    const props = renderToolbar({ playStatuses: ["playing"], matchAll: { tag: true } });
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("button", { name: "Clear filters" }));

    expect(props.onPlayStatusesChange).toHaveBeenCalledWith([]);
    expect(props.onPlayStatusExcludeChange).toHaveBeenCalledWith(false);
    expect(props.onMatchAllChange).toHaveBeenCalledWith({});
  });
});

describe("buildGameFilterParams", () => {
  it("only sends a match-all flag when two or more values are selected", () => {
    const params = buildGameFilterParams({
      tagIds: [1, 2],
      platformIds: [3],
      playStatuses: ["playing", "completed"],
      matchAll: { tag: true, platform: true, playStatus: true },
    });

    expect(params.tagMatchAll).toBe(true);
    expect(params.platformMatchAll).toBeUndefined();
    expect(params.playStatus).toEqual(["playing", "completed"]);
    expect(params.playStatusMatchAll).toBe(true);
  });
});

describe("GameFilterDialog on a Platform page", () => {
  it("hides the Platforms field when hidePlatformsField is set", async () => {
    renderToolbar({ hidePlatformsField: true });
    const { dialog } = await openFilters();

    expect(within(dialog).queryByLabelText("Platforms")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tags")).toBeInTheDocument();
  });

  it("shows the Platforms field by default", async () => {
    renderToolbar();
    const { dialog } = await openFilters();

    expect(within(dialog).getByLabelText("Platforms")).toBeInTheDocument();
  });
});

describe("GameFilterDialog Source filter", () => {
  it("is hidden unless the page wires it up", async () => {
    renderToolbar();
    const { dialog } = await openFilters();

    expect(within(dialog).queryByLabelText("Source")).not.toBeInTheDocument();
  });

  it("offers IGDB and Custom, and is cleared with the other filters", async () => {
    const props = renderToolbar({
      sources: ["custom"],
      onSourcesChange: vi.fn(),
      sourceExclude: true,
      onSourceExcludeChange: vi.fn(),
    });
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByLabelText("Source"));
    expect(await screen.findByRole("option", { name: "IGDB" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Custom" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(within(dialog).getByRole("button", { name: "Clear filters" }));
    expect(props.onSourcesChange).toHaveBeenCalledWith([]);
    expect(props.onSourceExcludeChange).toHaveBeenCalledWith(false);
  });

  it("sends source params only when a source is picked", () => {
    expect(buildGameFilterParams({ sources: ["custom"], sourceExclude: true })).toMatchObject({
      source: ["custom"],
      sourceExclude: true,
    });
    expect(buildGameFilterParams({ sourceExclude: true }).sourceExclude).toBeUndefined();
  });
});

describe("GameFilterDialog library and play filters", () => {
  it("offers the library's platform cards, PC split per storefront", async () => {
    const onPlatformKeysChange = vi.fn();
    renderToolbar({
      platformOptions: [
        { id: "6:digital:Steam", label: "PC · Steam" },
        { id: "130", label: "Nintendo Switch" },
      ],
      onPlatformKeysChange,
    });
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByLabelText("Platforms"));
    await user.click(await screen.findByRole("option", { name: "PC · Steam" }));

    expect(onPlatformKeysChange).toHaveBeenCalledWith(["6:digital:Steam"]);
  });

  it("clears the play filters along with the rest", async () => {
    const props = renderToolbar({ genreIds: [4], localPlayersMin: 2, coopOnly: true, timeToBeat: "5to15" });
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("button", { name: "Clear filters" }));

    expect(props.onGenreIdsChange).toHaveBeenCalledWith([]);
    expect(props.onLocalPlayersMinChange).toHaveBeenCalledWith(null);
    expect(props.onCoopOnlyChange).toHaveBeenCalledWith(false);
    expect(props.onTimeToBeatChange).toHaveBeenCalledWith(null);
  });
});

describe("buildGameFilterParams play filters", () => {
  it("sends platform cards as platformScope and keeps the shared Exclude", () => {
    const params = buildGameFilterParams({ platformScopes: ["6:digital:GOG"], platformExclude: true });

    expect(params.platformScope).toEqual(["6:digital:GOG"]);
    expect(params.platformId).toBeUndefined();
    expect(params.platformExclude).toBe(true);
  });

  it("only sends the toggles and thresholds that are set", () => {
    const params = buildGameFilterParams({
      genreIds: [4],
      localPlayersMin: 2,
      onlineMultiplayerOnly: false,
      coopOnly: true,
      timeToBeatMax: 5,
    });

    expect(params.genreId).toEqual([4]);
    expect(params.localPlayersMin).toBe(2);
    expect(params.onlineMultiplayerOnly).toBeUndefined();
    expect(params.coopOnly).toBe(true);
    expect(params.timeToBeatMin).toBeUndefined();
    expect(params.timeToBeatMax).toBe(5);
  });
});

describe("GameFilterDialog fields switched off in Settings", () => {
  it("leaves out the hidden fields and keeps the others", () => {
    renderToolbar({ hiddenFields: new Set(["format", "coop"] as const) });

    expect(screen.queryByRole("combobox", { name: "Formats" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Co-op" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Genres" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Online multiplayer" })).toBeInTheDocument();
  });
});
