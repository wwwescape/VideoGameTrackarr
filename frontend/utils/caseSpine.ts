import { resolveAssetUrl } from "../api/client";
import { platformLogoUrl, type LogoMode } from "./platformLogos";

// How the Game Shelf draws a game case's spine. Sizes are real-world millimetres (from the
// curated game cases); every case is drawn at the same fraction of real size, so a Saturn case
// towers over a DS case as it does on a real shelf.

// CSS reference pixels per millimetre (96 dpi): scale 1 would be true size on screen.
export const PX_PER_MM = 96 / 25.4;
// The shelf's default scale, and the slider's range.
export const DEFAULT_SHELF_SCALE = 0.4;
export const MIN_SHELF_SCALE = 0.25;
export const MAX_SHELF_SCALE = 0.7;

export interface PixelSize {
  width: number;
  height: number;
}

export function caseSizeToPixels(
  heightMm: number,
  spineMm: number,
  scale = DEFAULT_SHELF_SCALE
): PixelSize {
  return {
    // At least 4px, so the thinnest case stays visible (and clickable) at the smallest scale.
    width: Math.max(4, Math.round(spineMm * PX_PER_MM * scale)),
    height: Math.max(4, Math.round(heightMm * PX_PER_MM * scale)),
  };
}

// The spine logos, dropped into assets/game-cases/ and named in the CSV's Logo column. Vite
// picks every file up at build time, so a new logo needs no code change.
const caseLogoModules = import.meta.glob<string>("../assets/game-cases/*.{svg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

export function createCaseLogoLookup(modules: Record<string, string>) {
  const byFile = new Map(
    Object.entries(modules).map(([path, url]) => [(path.split("/").pop() ?? "").toLowerCase(), url])
  );
  return (file: string | null | undefined): string | null =>
    file ? (byFile.get(file.toLowerCase()) ?? null) : null;
}

export const gameCaseLogoUrl = createCaseLogoLookup(caseLogoModules);

// A platform's everyday logo (for Settings > Game Cases' rows): the bundled one for the colour
// mode when there is one, else IGDB's.
export function platformLogoSrc(
  platform: { slug: string | null; logoUrl?: string | null },
  mode: LogoMode = "light"
): string | null {
  return platformLogoUrl(platform.slug, mode) ?? resolveAssetUrl(platform.logoUrl ?? null);
}

// Readable text over a colour: near-black on light colours, white on dark ones. For the logo
// band's fallback short name, which sits on the band's own colour.
export function contrastTextColor(hex: string): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return "#ffffff";
  const value = parseInt(match[1], 16);
  const luminance =
    0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255);
  return luminance >= 150 ? "#161616" : "#ffffff";
}
