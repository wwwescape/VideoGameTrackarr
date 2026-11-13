import { describe, expect, it } from "vitest";
import { GAME_TYPE_OPTIONS } from "../../components/GameFilterDialog";
import { BROWSABLE_CATEGORIES, canBeInScreensaver } from "../screensaver";

const base = {
  parentGameId: null,
  category: "main_game" as const,
  owned: true,
  wishlisted: false,
  igdbId: 1942,
  coverUrl: "https://example.test/c.jpg",
};

describe("canBeInScreensaver", () => {
  it("lists the same kinds of game as the Filters dialog", () => {
    expect([...BROWSABLE_CATEGORIES].sort()).toEqual(GAME_TYPE_OPTIONS.map((option) => option.value).sort());
  });

  it("takes owned top-level games with a cover", () => {
    expect(canBeInScreensaver(base)).toBe(true);
    expect(canBeInScreensaver({ ...base, category: null })).toBe(true);
    expect(canBeInScreensaver({ ...base, category: "remaster" })).toBe(true);
  });

  it("leaves out add-ons, other kinds, unowned games and games without a cover", () => {
    expect(canBeInScreensaver({ ...base, parentGameId: 7 })).toBe(false);
    expect(canBeInScreensaver({ ...base, category: "dlc_addon" })).toBe(false);
    expect(canBeInScreensaver({ ...base, owned: false })).toBe(false);
    expect(canBeInScreensaver({ ...base, coverUrl: null })).toBe(false);
    expect(canBeInScreensaver({ ...base, coverUrl: "" })).toBe(false);
  });

  it("follows What to show", () => {
    const wanted = { ...base, owned: false, wishlisted: true };
    expect(canBeInScreensaver(wanted)).toBe(false);
    expect(canBeInScreensaver(wanted, { owned: true, wishlist: true, custom: true })).toBe(true);
    expect(canBeInScreensaver(base, { owned: false, wishlist: true, custom: true })).toBe(false);

    const custom = { ...base, igdbId: null };
    expect(canBeInScreensaver(custom)).toBe(true);
    expect(canBeInScreensaver(custom, { owned: true, wishlist: false, custom: false })).toBe(false);
  });
});
