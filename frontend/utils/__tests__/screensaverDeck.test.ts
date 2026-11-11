import { describe, expect, it } from "vitest";
import { avoidRepeat, hasEveryCover, shuffleDeck } from "../screensaverDeck";

const games = [1, 2, 3, 4, 5].map((id) => ({ id }));

describe("screensaverDeck", () => {
  it("shuffles every cover exactly once", () => {
    const deck = shuffleDeck(games, null);
    expect(deck.map((game) => game.id).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(games.map((game) => game.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("never starts with the cover that was just on screen", () => {
    // random() = 0.999 leaves every element in place, so 1 would stay first.
    const deck = shuffleDeck(games, 1, () => 0.999);
    expect(deck[0].id).not.toBe(1);
    expect(deck).toHaveLength(5);
  });

  it("moves a repeat to the end, but leaves a single cover alone", () => {
    expect(avoidRepeat([{ id: 7 }, { id: 8 }], 7).map((game) => game.id)).toEqual([8, 7]);
    expect(avoidRepeat([{ id: 7 }], 7).map((game) => game.id)).toEqual([7]);
    expect(avoidRepeat([{ id: 8 }, { id: 7 }], 7).map((game) => game.id)).toEqual([8, 7]);
  });

  it("knows when the deck already holds every cover", () => {
    expect(hasEveryCover(5, 5)).toBe(true);
    expect(hasEveryCover(500, 1200)).toBe(false);
  });
});
