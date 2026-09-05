// Platform-family slugs, verified live against the real IGDB API (Platform has no "family"
// column to group these itself). Note PlayStation 4's live slug is "ps4--1", not "ps4" (an
// IGDB dedup artifact) — this intentionally does NOT match the "ps4" constants elsewhere in
// the codebase (LibraryItemDialog's old sales-tracking set, platprices_service.py), which
// appear to predate that change.
export const PC_FAMILY_PLATFORM_SLUGS = new Set(["win", "mac", "linux"]);
export const XBOX_FAMILY_PLATFORM_SLUGS = new Set(["xbox", "xbox360", "xboxone", "series-x-s"]);
export const PLAYSTATION_FAMILY_PLATFORM_SLUGS = new Set([
  "ps",
  "ps2",
  "ps3",
  "ps4--1",
  "ps5",
  "psvita",
  "psp",
]);
export const ANDROID_PLATFORM_SLUGS = new Set(["android"]);
export const APPLE_PLATFORM_SLUGS = new Set(["ios"]);
