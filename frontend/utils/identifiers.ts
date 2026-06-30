export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Devices/Accessories aren't uniquely named (a user can own two of the same SKU), so the
// route identifier combines a cosmetic name-derived slug with the catalog row's `uuid` —
// the backend resolves purely by the trailing uuid and never parses the slug itself.
export function hardwareIdentifier(officialName: string, uuid: string): string {
  return `${slugify(officialName)}-${uuid}`;
}

// Games/addons imported from IGDB already carry IGDB's own slug — use it as-is. Manually-added
// ones have no such slug, so they fall back to the same name-slug+uuid scheme as hardware.
export function gameIdentifier(game: { slug: string | null; uuid: string; name: string }): string {
  return game.slug ?? hardwareIdentifier(game.name, game.uuid);
}
