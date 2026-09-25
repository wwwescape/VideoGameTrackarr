import type { PlatformResponse } from "../api/types";
import {
  ANDROID_PLATFORM_SLUGS,
  APPLE_PLATFORM_SLUGS,
  PC_FAMILY_PLATFORM_SLUGS,
  PLAYSTATION_FAMILY_PLATFORM_SLUGS,
  XBOX_FAMILY_PLATFORM_SLUGS,
} from "./platformFamilies";

// Shared by LibraryItemDialog.tsx and BulkAddDialog.tsx's Step 3 (both let the user pick a
// Digital Storefront for a Platform+Format combination) — extracted here so the two forms
// can't drift out of sync on which storefronts exist for which platforms.

// PC-family platforms are the only ones with more than one realistic digital storefront —
// consoles are tied to their manufacturer's own store, so this list only needs to cover
// win/mac/linux. Free text (via Autocomplete's freeSolo) still works for anything not on
// the list. Not every storefront is available on every PC platform — Steam and GOG ship on
// Windows, Mac, and Linux; Epic Games Store only ships on Windows and Mac (no Linux client).
// The rest haven't been asked about, so they stay Windows-only, same as before this list was
// split per platform.
export const DIGITAL_STOREFRONT_PLATFORM_SLUGS: Record<string, ReadonlySet<string>> = {
  Steam: new Set(["win", "mac", "linux"]),
  GOG: new Set(["win", "mac", "linux"]),
  "Epic Games Store": new Set(["win", "mac"]),
  "Ubisoft Connect": new Set(["win"]),
  "EA App": new Set(["win"]),
  "Battle.net": new Set(["win"]),
  "Microsoft Store": new Set(["win"]),
  "itch.io": new Set(["win"]),
};

// Everything outside the PC family only ever has one real digital storefront — shown as a
// disabled/readonly dropdown (rather than editable, like the PC list above) since there's
// nothing for the user to actually choose.
export const FIXED_DIGITAL_STOREFRONTS: { slugs: ReadonlySet<string>; storefront: string }[] = [
  { slugs: PLAYSTATION_FAMILY_PLATFORM_SLUGS, storefront: "PlayStation Store" },
  { slugs: XBOX_FAMILY_PLATFORM_SLUGS, storefront: "Xbox Store" },
  { slugs: ANDROID_PLATFORM_SLUGS, storefront: "Google Play" },
  { slugs: APPLE_PLATFORM_SLUGS, storefront: "App Store" },
];

export interface StorefrontResolution {
  // PC-family: an editable freeSolo Autocomplete, seeded with digitalStorefrontOptions.
  showEditableStorefront: boolean;
  // Non-PC digital platform with exactly one real storefront (e.g. Xbox -> "Xbox Store").
  fixedStorefront: string | undefined;
  digitalStorefrontOptions: string[];
}

export function resolveStorefront(
  platform: PlatformResponse | undefined,
  isDigital: boolean
): StorefrontResolution {
  const slug = platform?.slug;
  const showEditableStorefront = isDigital && slug != null && PC_FAMILY_PLATFORM_SLUGS.has(slug);
  const fixedStorefront = isDigital
    ? FIXED_DIGITAL_STOREFRONTS.find((entry) => slug != null && entry.slugs.has(slug))?.storefront
    : undefined;
  const digitalStorefrontOptions = Object.entries(DIGITAL_STOREFRONT_PLATFORM_SLUGS)
    .filter(([, slugs]) => slug != null && slugs.has(slug))
    .map(([storefront]) => storefront)
    .sort((a, b) => a.localeCompare(b));
  return { showEditableStorefront, fixedStorefront, digitalStorefrontOptions };
}
