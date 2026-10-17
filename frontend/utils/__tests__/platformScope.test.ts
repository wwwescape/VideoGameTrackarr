import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { parsePlatformScope, platformDisplayName, platformScopeQuery } from "../platformScope";

const t = ((key: string) => ({ "games.library.formatPhysical": "Physical", "games.library.formatDigital": "Digital" })[
  key
] ?? key) as unknown as TFunction;

const pc = { name: "PC (Microsoft Windows)", abbreviation: "PC" };

describe("parsePlatformScope", () => {
  it("reads a digital storefront scope", () => {
    expect(parsePlatformScope(new URLSearchParams("format=digital&storefront=Steam"))).toEqual({
      format: "digital",
      storefront: "Steam",
    });
  });

  it("ignores a storefront on a non-digital format, and an unknown format", () => {
    expect(parsePlatformScope(new URLSearchParams("format=physical&storefront=Steam"))).toEqual({
      format: "physical",
      storefront: undefined,
    });
    expect(parsePlatformScope(new URLSearchParams("format=vinyl"))).toEqual({});
    expect(parsePlatformScope(new URLSearchParams(""))).toEqual({});
  });
});

describe("platformScopeQuery", () => {
  it("round-trips through parsePlatformScope", () => {
    const scope = { format: "digital" as const, storefront: "Epic Games Store" };
    const query = platformScopeQuery(scope);

    expect(parsePlatformScope(new URLSearchParams(query))).toEqual(scope);
    expect(platformScopeQuery({})).toBe("");
  });
});

describe("platformDisplayName", () => {
  it("names a scoped card after its storefront or format", () => {
    expect(platformDisplayName(pc, { format: "digital", storefront: "Steam" }, t)).toBe("PC · Steam");
    expect(platformDisplayName(pc, { format: "digital" }, t)).toBe("PC · Digital");
    expect(platformDisplayName(pc, { format: "physical" }, t)).toBe("PC · Physical");
  });

  it("uses the platform's own name without a scope", () => {
    expect(platformDisplayName(pc, {}, t)).toBe("PC (Microsoft Windows)");
  });
});
