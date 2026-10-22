import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { getNavDestinations } from "../destinations";

// Labels echo their i18n key, so destinations are identified by `to` throughout.
const t = ((key: string) => key) as unknown as TFunction;

describe("getNavDestinations", () => {
  it("puts Bookshelf in the Games menu right after Add Game", () => {
    const destinations = getNavDestinations(t);
    const games = destinations.find((destination) => destination.to === "/games");
    const subTos = (games?.subItems ?? []).map((item) => item.to);
    expect(subTos.indexOf("/games/bookshelf")).toBe(subTos.indexOf("/games/add") + 1);
    // A Games sub-item only — never a top-level destination of its own.
    expect(destinations.map((destination) => destination.to)).not.toContain("/games/bookshelf");
  });
});
