import type { ShelfPlatform } from "../api/types";

// A shelf platform with a plain case look, for the Game Shelf tests.
export const shelfPlatform = (
  id: number,
  name: string,
  heightMm: number,
  spineMm: number
): ShelfPlatform => ({
  id,
  name,
  slug: null,
  abbreviation: null,
  logoUrl: null,
  case: {
    platformSlug: `p${id}`,
    caseLabel: "Case",
    heightMm,
    spineMm,
    caseColor: "#111111",
    logoBandColor: "#222222",
    logoBandHeightPct: 15,
    caseTopMm: 0,
    logoColor: null,
    logoLineColor: null,
    logo: null,
    titleBandColor: "#333333",
    titleTextColor: "#ffffff",
  },
});
