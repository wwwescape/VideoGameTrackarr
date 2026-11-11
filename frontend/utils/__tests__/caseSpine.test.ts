import { describe, expect, it } from "vitest";
import {
  caseSizeToPixels,
  contrastTextColor,
  createCaseLogoLookup,
  platformLogoSrc,
} from "../caseSpine";

describe("caseSizeToPixels", () => {
  it("draws real millimetres at the given scale", () => {
    // A DVD case (190 × 14 mm) at 40%: 190 mm is 718 CSS px at 96 dpi.
    expect(caseSizeToPixels(190, 14, 0.4)).toEqual({ width: 21, height: 287 });
    expect(caseSizeToPixels(190, 14, 1)).toEqual({ width: 53, height: 718 });
  });

  it("keeps cases in their real proportions", () => {
    const saturn = caseSizeToPixels(212, 22, 0.4);
    const ds = caseSizeToPixels(137, 15, 0.4);
    expect(saturn.height / ds.height).toBeCloseTo(212 / 137, 1);
  });

  it("never draws a case thinner than 4px", () => {
    expect(caseSizeToPixels(100, 1, 0.1)).toEqual({ width: 4, height: 38 });
  });
});

describe("createCaseLogoLookup", () => {
  const lookup = createCaseLogoLookup({
    "../assets/game-cases/ps5.svg": "/assets/ps5-abc.svg",
    "../assets/game-cases/Switch.png": "/assets/switch-def.png",
  });

  it("finds a logo by the CSV's file name, ignoring case", () => {
    expect(lookup("ps5.svg")).toBe("/assets/ps5-abc.svg");
    expect(lookup("switch.png")).toBe("/assets/switch-def.png");
  });

  it("returns null for no file or a missing one", () => {
    expect(lookup(null)).toBeNull();
    expect(lookup("xbox.svg")).toBeNull();
  });
});

describe("platformLogoSrc", () => {
  it("picks the bundled logo for the colour mode", () => {
    expect(platformLogoSrc({ slug: "ps5" }, "dark")).toMatch(/ps5-dark\.png/);
    expect(platformLogoSrc({ slug: "ps5" })).toMatch(/ps5\.png/);
    // The Switch logo reads on both themes, so dark mode keeps it.
    expect(platformLogoSrc({ slug: "switch" }, "dark")).toBe(platformLogoSrc({ slug: "switch" }));
  });

  it("falls back to IGDB's logo without a bundled one", () => {
    expect(
      platformLogoSrc({ slug: "no-such-platform", logoUrl: "https://images.igdb.com/x.png" })
    ).toBe("https://images.igdb.com/x.png");
    expect(platformLogoSrc({ slug: null, logoUrl: null })).toBeNull();
  });
});

describe("contrastTextColor", () => {
  it("prints dark on light colours and white on dark ones", () => {
    expect(contrastTextColor("#ffffff")).toBe("#161616");
    expect(contrastTextColor("#d40000")).toBe("#ffffff");
    expect(contrastTextColor("not a colour")).toBe("#ffffff");
  });
});
