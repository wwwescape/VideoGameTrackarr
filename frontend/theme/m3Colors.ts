import { argbFromHex, Hct, hexFromArgb, SchemeVibrant } from "@material/material-color-utilities";

// Vivid purple — distinctive for a game tracker, doesn't collide with platform brand
// colors (Xbox green, PlayStation blue, Steam's dark blue), echoes the Twitch/IGDB
// ecosystem this app integrates with.
export const SEED_COLOR_HEX = "#7C4DFF";

// SchemeVibrant (not SchemeExpressive) is the deliberate choice here: "Material 3
// Expressive" is Google's 2025 update to shape/motion/type, not a mandate to use the
// color-utilities library's literal "Expressive" scheme variant — that variant shifts
// secondary/tertiary hues far enough from the seed that this app's chosen purple
// wouldn't actually end up as the primary color. Vibrant stays closest to the seed hue
// while still being maximally saturated, which is what "vivid purple" actually means
// here. Shape/typography carry the "Expressive" feel instead (see m3Shape.ts).
export type ColorMode = "light" | "dark";
export type ContrastLevel = "normal" | "high";

export interface M3Scheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

const ROLE_KEYS: (keyof M3Scheme)[] = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "shadow",
  "scrim",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
];

const CONTRAST_LEVEL_VALUE: Record<ContrastLevel, number> = {
  normal: 0,
  high: 1,
};

export function buildM3Scheme(mode: ColorMode, contrast: ContrastLevel, seedHex: string = SEED_COLOR_HEX): M3Scheme {
  const sourceHct = Hct.fromInt(argbFromHex(seedHex));
  const dynamicScheme = new SchemeVibrant(sourceHct, mode === "dark", CONTRAST_LEVEL_VALUE[contrast]);

  const scheme = {} as M3Scheme;
  for (const key of ROLE_KEYS) {
    // DynamicScheme exposes each role as a getter returning an ARGB int.
    const argb = (dynamicScheme as unknown as Record<string, number>)[key];
    scheme[key] = hexFromArgb(argb);
  }
  return scheme;
}
