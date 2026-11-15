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

// Hardware platforms are named after their console generation ("PlayStation 5", "Xbox Series"
// — the Generation column of docs/data/hardware), not IGDB slugs, so each maps to the logo of
// the matching IGDB platform here. A name not listed tries its own slug ("Dreamcast" →
// dreamcast.png), so a new logo can still be dropped in without a code change.
const HARDWARE_PLATFORM_LOGO_SLUGS: Record<string, string> = {
  "Game Boy": "gb",
  "Game Boy Advance": "gba",
  "Game Boy Color": "gbc",
  GameCube: "ngc",
  NES: "nes",
  "Nintendo 3DS": "3ds",
  "Nintendo 64": "n64",
  "Nintendo DS": "nds",
  "Nintendo Switch": "switch",
  "Nintendo Switch 2": "switch-2",
  PlayStation: "ps",
  "PlayStation 2": "ps2",
  "PlayStation 3": "ps3",
  "PlayStation 4": "ps4",
  "PlayStation 5": "ps5",
  "PlayStation Portable": "psp",
  "PlayStation Vita": "psvita",
  SNES: "snes",
  Wii: "wii",
  "Wii U": "wiiu",
  Xbox: "xbox",
  "Xbox 360": "xbox360",
  "Xbox One": "xboxone",
  "Xbox Series": "series-x-s",
};

export function hardwarePlatformLogoUrl(name: string, mode: LogoMode = "light"): string | undefined {
  const slug = HARDWARE_PLATFORM_LOGO_SLUGS[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return platformLogoUrl(slug, mode);
}
