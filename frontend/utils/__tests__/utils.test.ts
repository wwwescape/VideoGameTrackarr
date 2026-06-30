import { describe, expect, it } from "vitest";
import { getAddonType, getReleaseYear, isAddon } from "../utils";

describe("getReleaseYear", () => {
  it("converts a unix timestamp to its calendar year", () => {
    expect(getReleaseYear(1_700_000_000)).toBe(2023);
  });

  it.each([null, undefined, 0])("returns null for %s", (value) => {
    expect(getReleaseYear(value)).toBeNull();
  });
});

describe("getAddonType", () => {
  it("maps a known addon category to its display label", () => {
    expect(getAddonType({ category: "dlc_addon" })).toBe("DLC");
    expect(getAddonType({ category: "expansion" })).toBe("Expansion");
  });

  it("returns undefined for a main_game (not in the addon label map)", () => {
    expect(getAddonType({ category: "main_game" })).toBeUndefined();
  });

  it("returns undefined when there's no category at all", () => {
    expect(getAddonType({ category: null })).toBeUndefined();
    expect(getAddonType({})).toBeUndefined();
  });
});

describe("isAddon", () => {
  it("is true for any non-main_game category", () => {
    expect(isAddon({ category: "dlc_addon" })).toBe(true);
    expect(isAddon({ category: "remaster" })).toBe(true);
  });

  it("is false for main_game or no category", () => {
    expect(isAddon({ category: "main_game" })).toBe(false);
    expect(isAddon({ category: null })).toBe(false);
    expect(isAddon({})).toBe(false);
  });
});
