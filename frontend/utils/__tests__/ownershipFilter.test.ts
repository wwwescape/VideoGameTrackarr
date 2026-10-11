import { describe, expect, it } from "vitest";
import { matchesOwnership } from "../ownershipFilter";

const ownedOnly = { owned: true, wishlisted: false };
const both = { owned: true, wishlisted: true };
const neither = { owned: false, wishlisted: false };

describe("matchesOwnership", () => {
  it("matches everything when no status is selected", () => {
    expect(matchesOwnership(neither, [], false, true)).toBe(true);
  });

  it("matches any selected status by default", () => {
    expect(matchesOwnership(ownedOnly, ["owned", "wishlisted"], false, false)).toBe(true);
    expect(matchesOwnership(neither, ["owned", "wishlisted"], false, undefined)).toBe(false);
  });

  it("needs every selected status when matching all", () => {
    expect(matchesOwnership(ownedOnly, ["owned", "wishlisted"], false, true)).toBe(false);
    expect(matchesOwnership(both, ["owned", "wishlisted"], false, true)).toBe(true);
  });

  it("negates whichever mode is chosen when excluding", () => {
    expect(matchesOwnership(ownedOnly, ["owned", "wishlisted"], true, false)).toBe(false);
    expect(matchesOwnership(ownedOnly, ["owned", "wishlisted"], true, true)).toBe(true);
  });
});
