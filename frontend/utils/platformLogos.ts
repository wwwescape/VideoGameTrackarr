// Platform logos are PNG files dropped into assets/platforms/, named after the platform's
// IGDB slug (ps5.png, switch.png, win.png, …). Vite picks every one up at build time, so a
// new logo needs no code change. IGDB sometimes adds a "--N" suffix to a slug (e.g.
// "ps4--1"), so lookups ignore it: ps4.png covers both.
const logoModules = import.meta.glob<string>("../assets/platforms/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

// A logo whose dark parts would vanish on the dark theme has a `<slug>-dark.png` beside it, the
// same logo with only those parts lightened. Dark mode uses it when there is one, else the
// regular logo.
export type LogoMode = "light" | "dark";
const DARK_SUFFIX = "-dark";

// Split out from platformLogoUrl so tests can feed it a fake file list.
export function createLogoLookup(modules: Record<string, string>) {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const [path, url] of Object.entries(modules)) {
    const name = (path.split("/").pop() ?? "").replace(/\.[^.]+$/, "").toLowerCase();
    if (name.endsWith(DARK_SUFFIX)) dark.set(name.slice(0, -DARK_SUFFIX.length), url);
    else light.set(name, url);
  }
  return (slug: string | null | undefined, mode: LogoMode = "light"): string | undefined => {
    if (!slug) return undefined;
    const key = slug.split("--")[0].toLowerCase();
    return (mode === "dark" ? dark.get(key) : undefined) ?? light.get(key);
  };
}

export const platformLogoUrl = createLogoLookup(logoModules);

// Platform pages link by slug, falling back to the id for a platform without one.
export function platformIdentifier(platform: { id: number; slug: string | null }): string {
  return platform.slug ?? String(platform.id);
}
