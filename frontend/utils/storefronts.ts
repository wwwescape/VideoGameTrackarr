// Every digital storefront this app knows about — the PC-family options plus each non-PC
// platform family's one fixed storefront (see LibraryItemDialog.tsx's own
// DIGITAL_STOREFRONT_PLATFORM_SLUGS/FIXED_DIGITAL_STOREFRONTS, which this list mirrors).
// Used to make the Games list's Storefront filter always offer the full known set — e.g.
// PlayStation Store/Xbox Store — even before any digital library item using it has been
// added yet, rather than only ever showing whatever already happens to exist in the data.
export const ALL_KNOWN_STOREFRONTS: readonly string[] = [
  "Steam",
  "GOG",
  "Epic Games Store",
  "Ubisoft Connect",
  "EA App",
  "Battle.net",
  "Microsoft Store",
  "itch.io",
  "PlayStation Store",
  "Xbox Store",
  "Google Play",
  "App Store",
];
