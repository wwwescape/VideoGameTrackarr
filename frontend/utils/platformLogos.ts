// Platform logos are plain files dropped into assets/platforms/, named after the platform's
// IGDB slug (ps5.png, switch.svg, win.webp, …). Vite picks every one up at build time, so a
// new logo needs no code change. IGDB sometimes adds a "--N" suffix to a slug (e.g.
// "ps4--1"), so lookups ignore it: ps4.png covers both.
const logoModules = import.meta.glob<string>("../assets/platforms/*.{png,svg,webp,jpg}", {
  eager: true,
  query: "?url",
  import: "default",
});

// Split out from platformLogoUrl so tests can feed it a fake file list.
export function createLogoLookup(modules: Record<string, string>) {
  const logoBySlug = new Map<string, string>(
    Object.entries(modules).map(([path, url]) => {
      const fileName = path.split("/").pop() ?? "";
      return [fileName.replace(/\.[^.]+$/, "").toLowerCase(), url];
    })
  );
  return (slug: string | null | undefined): string | undefined => {
    if (!slug) return undefined;
    return logoBySlug.get(slug.split("--")[0].toLowerCase());
  };
}

export const platformLogoUrl = createLogoLookup(logoModules);

// Platform pages link by slug, falling back to the id for a platform without one.
export function platformIdentifier(platform: { id: number; slug: string | null }): string {
  return platform.slug ?? String(platform.id);
}
