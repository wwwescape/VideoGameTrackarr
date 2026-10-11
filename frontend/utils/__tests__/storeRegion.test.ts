import { describe, expect, it } from "vitest";
import { detectBrowserStoreRegion, localiseStoreUrl, resolveStoreRegion } from "../storeRegion";

const PS = "https://store.playstation.com/en-us/concept/10012238";
const XBOX = "https://www.xbox.com/en-us/games/store/indiana-jones-and-the-great-circle/9N8FQ28Z6QX3";

describe("localiseStoreUrl", () => {
  it("swaps the PlayStation Store locale (lower-case) and the Xbox locale (upper-case country)", () => {
    expect(localiseStoreUrl(PS, "playstation", "IN", "en")).toBe(
      "https://store.playstation.com/en-in/concept/10012238"
    );
    expect(localiseStoreUrl(XBOX, "xbox", "IN", "en")).toBe(
      "https://www.xbox.com/en-IN/games/store/indiana-jones-and-the-great-circle/9N8FQ28Z6QX3"
    );
  });

  it("inserts a locale when IGDB's link has none", () => {
    expect(localiseStoreUrl("https://store.playstation.com/concept/10012238", "playstation", "GB", "en")).toBe(
      "https://store.playstation.com/en-gb/concept/10012238"
    );
    expect(localiseStoreUrl("https://www.xbox.com/games/store/x/9N8FQ28Z6QX3", "xbox", "DE", "en")).toBe(
      "https://www.xbox.com/de-DE/games/store/x/9N8FQ28Z6QX3"
    );
  });

  it("replaces a three-part locale and keeps the query, hash and trailing slash", () => {
    expect(
      localiseStoreUrl("https://store.playstation.com/zh-hant-hk/product/EP0001/?a=1#top", "playstation", "JP", "en")
    ).toBe("https://store.playstation.com/ja-jp/product/EP0001/?a=1#top");
  });

  it("uses the store's exceptions to the obvious language-country pair", () => {
    expect(localiseStoreUrl(PS, "playstation", "CZ", "en")).toBe("https://store.playstation.com/en-cz/concept/10012238");
    expect(localiseStoreUrl(XBOX, "xbox", "SA", "en")).toContain("https://www.xbox.com/ar-SA/");
  });

  it("prefers VGT's language where the store offers it in that country", () => {
    expect(localiseStoreUrl(PS, "playstation", "CA", "fr")).toContain("/fr-ca/");
    expect(localiseStoreUrl(PS, "playstation", "CA", "en")).toContain("/en-ca/");
    expect(localiseStoreUrl(XBOX, "xbox", "CH", "fr")).toContain("/fr-CH/");
    expect(localiseStoreUrl(XBOX, "xbox", "CH", "es")).toContain("/de-CH/");
  });

  it("leaves the link alone without a region, for an unknown region, another site or a malformed URL", () => {
    expect(localiseStoreUrl(PS, "playstation", null, "en")).toBe(PS);
    expect(localiseStoreUrl(PS, "playstation", "ZZ", "en")).toBe(PS);
    expect(localiseStoreUrl("https://www.microsoft.com/en-us/p/x/9N8F", "xbox", "IN", "en")).toBe(
      "https://www.microsoft.com/en-us/p/x/9N8F"
    );
    expect(localiseStoreUrl("not a url", "playstation", "IN", "en")).toBe("not a url");
  });
});

describe("detectBrowserStoreRegion / resolveStoreRegion", () => {
  it("takes the first supported country from the browser's languages", () => {
    expect(detectBrowserStoreRegion(["en-IN", "en"])).toBe("IN");
    expect(detectBrowserStoreRegion(["en", "pt-BR"])).toBe("BR");
    expect(detectBrowserStoreRegion(["en-XX", "fr-FR"])).toBe("FR");
    expect(detectBrowserStoreRegion(["fr", "en"])).toBeNull();
  });

  it("resolves auto, off and explicit choices", () => {
    expect(resolveStoreRegion("auto", ["en-IN"])).toBe("IN");
    expect(resolveStoreRegion("auto", ["en"])).toBeNull();
    expect(resolveStoreRegion("off", ["en-IN"])).toBeNull();
    expect(resolveStoreRegion("GB", ["en-IN"])).toBe("GB");
    expect(resolveStoreRegion("ZZ", ["en-IN"])).toBeNull();
  });
});
