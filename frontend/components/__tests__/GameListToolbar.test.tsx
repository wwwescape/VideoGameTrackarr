import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tag } from "../../api/types";
import { buildGameFilterParams } from "../../api/games";
import GameListToolbar from "../GameListToolbar";

const tags: Tag[] = [
  { id: 1, name: "Roguelike", color: null, textColor: null },
  { id: 2, name: "Metroidvania", color: null, textColor: null },
];

function renderToolbar(overrides: Partial<ComponentProps<typeof GameListToolbar>> = {}) {
  const props: ComponentProps<typeof GameListToolbar> = {
    searchKeyword: "",
    onSearchKeywordChange: vi.fn(),
    ownershipStatuses: [],
    onOwnershipStatusesChange: vi.fn(),
    ownershipExclude: false,
    onOwnershipExcludeChange: vi.fn(),
    platformOptions: [],
    platformIds: [],
    onPlatformIdsChange: vi.fn(),
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
    sort: "name_asc",
    onSortChange: vi.fn(),
    ...overrides,
  };
  render(<GameListToolbar {...props} />);
  return props;
}

async function openFilters() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Filters & More" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

// Filter tab order is Game Types, Tags, Ownership, ... and Game Types has no match toggle,
// so the Tags field's toggle is the first one.
const TAGS_GROUP = 0;

describe("GameListToolbar match mode", () => {
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
    // Formats, Collections, Series (Storefront only shows once Digital is picked).
    expect(within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" })).toHaveLength(7);
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

describe("GameListToolbar on a Platform page", () => {
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
