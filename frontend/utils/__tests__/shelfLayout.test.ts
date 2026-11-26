import { describe, expect, it } from "vitest";
import type { ShelfCaseEntry } from "../../api/types";
import { shelfPlatform } from "../../test/shelfFixtures";
import { buildShelfItems, packRows, platformCaseSize, type ShelfItem } from "../shelfLayout";

const PS5 = shelfPlatform(1, "PlayStation 5", 171, 12);
const SWITCH = shelfPlatform(2, "Nintendo Switch", 170, 10.5);

const shelfCase = (
  gameId: number,
  name: string,
  platformId: number,
  steelbook = false
): ShelfCaseEntry => ({
  gameId,
  name,
  platformId,
  steelbook,
});

describe("platformCaseSize", () => {
  it("draws a platform's case at the scale", () => {
    expect(platformCaseSize(PS5, 0.4)).toEqual({ width: 18, height: 259 });
  });

  it("draws a Steelbook as tall as the case, a steel rim wider on each side", () => {
    // 1.5mm rims at 259px for 171mm: 2px each side.
    expect(platformCaseSize(PS5, 0.4, true)).toEqual({ width: 22, height: 259 });
    expect(platformCaseSize(SWITCH, 0.4, true)).toEqual({ width: 20, height: 257 });
  });
});

describe("buildShelfItems", () => {
  const cases = [
    shelfCase(1, "Astro Bot", 1),
    shelfCase(2, "Bayonetta 3", 2),
    shelfCase(3, "Celeste", 2),
  ];

  it("keeps the requested order, platforms mixed", () => {
    expect(buildShelfItems(cases, [PS5, SWITCH], 0.4).map((item) => item.case.name)).toEqual([
      "Astro Bot",
      "Bayonetta 3",
      "Celeste",
    ]);
  });

  it("sizes each case from its platform's case", () => {
    const [astro, bayonetta] = buildShelfItems(cases, [PS5, SWITCH], 0.4);
    expect([astro.width, astro.height]).toEqual([18, 259]);
    expect([bayonetta.width, bayonetta.height]).toEqual([16, 257]);
  });

  it("keeps a game's case and Steelbook on one platform apart, each at its own size", () => {
    const [standard, steel] = buildShelfItems(
      [shelfCase(1, "Astro Bot", 1), shelfCase(1, "Astro Bot", 1, true)],
      [PS5],
      0.4
    );
    expect([standard.key, steel.key]).toEqual(["1:1:c", "1:1:s"]);
    expect([standard.width, standard.height]).toEqual([18, 259]);
    expect([steel.width, steel.height]).toEqual([22, 259]);
  });

  it("skips a case whose platform isn't in the payload", () => {
    expect(buildShelfItems(cases, [PS5], 0.4).map((item) => item.case.name)).toEqual(["Astro Bot"]);
  });

  it("scales every case", () => {
    const [small] = buildShelfItems([cases[0]], [PS5], 0.25);
    const [large] = buildShelfItems([cases[0]], [PS5], 0.7);
    expect(large.height).toBeGreaterThan(small.height * 2.5);
  });
});

describe("packRows", () => {
  const item = (key: string, width: number): ShelfItem =>
    ({ key, width, height: width * 10, platform: PS5, case: shelfCase(1, key, 1) }) as ShelfItem;

  it("fills a row, then starts the next, losing nothing", () => {
    const rows = packRows([item("a", 20), item("b", 20), item("c", 20)], 45, 3);
    expect(rows.map((row) => row.items.map((entry) => entry.key))).toEqual([["a", "b"], ["c"]]);
    expect(rows[0].height).toBe(200);
  });

  it("gives a case wider than the shelf a row of its own", () => {
    const rows = packRows([item("wide", 100), item("b", 10)], 50, 3);
    expect(rows.map((row) => row.items.map((entry) => entry.key))).toEqual([["wide"], ["b"]]);
  });

  it("handles an empty shelf", () => {
    expect(packRows([], 500)).toEqual([]);
  });
});
