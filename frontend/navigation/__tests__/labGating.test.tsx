import { describe, expect, it } from "vitest";
import type { LabId } from "../../api/labs";
import { isSubDestinationEnabled, navGroups, settingsPages } from "../destinations";

const gamesSubPages = () =>
  navGroups.flatMap((group) => group.items).find((item) => item.to === "/games")!.subItems!;

describe("lab-gated nav entries", () => {
  const off = new Set<LabId>();
  const on = new Set<LabId>(["game_shelf"]);

  it("hide the Game Shelf and Settings → Game Cases while the lab is off", () => {
    expect(
      gamesSubPages()
        .filter((sub) => isSubDestinationEnabled(sub, off))
        .map((sub) => sub.to)
    ).not.toContain("/games/shelf");
    expect(
      settingsPages()
        .filter((page) => isSubDestinationEnabled(page, off))
        .map((page) => page.to)
    ).not.toContain("/settings/game-cases");
  });

  it("show them, Game Shelf right after Add Game, once it's on", () => {
    const games = gamesSubPages()
      .filter((sub) => isSubDestinationEnabled(sub, on))
      .map((sub) => sub.to);
    expect(games.slice(0, 3)).toEqual(["/games/add", "/games/shelf", "/games/collections"]);
    expect(
      settingsPages()
        .filter((page) => isSubDestinationEnabled(page, on))
        .map((page) => page.to)
    ).toContain("/settings/game-cases");
  });

  it("show Settings → Filter Presets only while its lab is on", () => {
    const pages = (labs: Set<LabId>) =>
      settingsPages()
        .filter((page) => isSubDestinationEnabled(page, labs))
        .map((page) => page.to);
    expect(pages(off)).not.toContain("/settings/filter-presets");
    expect(pages(new Set<LabId>(["filter_presets"]))).toContain("/settings/filter-presets");
  });

  it("put Labs right after Tag Manager, always shown", () => {
    const pages = settingsPages().filter((page) => isSubDestinationEnabled(page, off));
    expect(pages.slice(0, 2).map((page) => page.to)).toEqual(["/settings/tags", "/settings/labs"]);
  });
});
