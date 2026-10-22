// Actual physical game-case sizes (height x spine thickness, millimetres)
// and the Bookshelf's fixed rendering of them: cases render at exactly
// CASE_RENDER_SCALE (40%) of actual size. PX_PER_MM is the CSS reference
// pixel density (96 dpi), so 100% would be true physical size on screen.

export interface CaseSizePreset {
  id: string;
  label: string;
  heightMm: number;
  spineMm: number;
}

export const CASE_SIZE_PRESETS: CaseSizePreset[] = [
  { id: "switch", label: "Nintendo Switch", heightMm: 170, spineMm: 10.4 },
  { id: "bluray", label: "Blu-ray case", heightMm: 171, spineMm: 12 },
  { id: "dvd", label: "DVD case", heightMm: 184, spineMm: 14 },
  { id: "genesis", label: "Sega Genesis / Mega Drive", heightMm: 184, spineMm: 25 },
  { id: "saturn", label: "Sega Saturn longbox", heightMm: 212, spineMm: 22 },
  { id: "jewel", label: "CD jewel case", heightMm: 142, spineMm: 10 },
  { id: "ds", label: "Nintendo DS", heightMm: 137, spineMm: 15 },
  { id: "n3ds", label: "Nintendo 3DS", heightMm: 137, spineMm: 12 },
  { id: "psp", label: "PSP", heightMm: 178, spineMm: 14 },
  { id: "vita", label: "PS Vita", heightMm: 137, spineMm: 12 },
  { id: "nesbox", label: "NES box", heightMm: 178, spineMm: 25 },
  { id: "snesbox", label: "SNES box", heightMm: 181, spineMm: 29 },
  { id: "n64box", label: "Nintendo 64 box", heightMm: 178, spineMm: 25 },
  { id: "gbbox", label: "Game Boy box", heightMm: 140, spineMm: 25 },
  { id: "atari", label: "Atari 2600 box", heightMm: 190, spineMm: 25 },
  { id: "neogeo", label: "Neo Geo AES", heightMm: 240, spineMm: 32 },
];

export const CASE_RENDER_SCALE = 0.4;
export const PX_PER_MM = 3.7796;

export function caseSizeToPixels(
  heightMm: number,
  spineMm: number
): { width: number; height: number } {
  return {
    width: Math.round(spineMm * PX_PER_MM * CASE_RENDER_SCALE),
    height: Math.round(heightMm * PX_PER_MM * CASE_RENDER_SCALE),
  };
}

const presetById = (id: string) => CASE_SIZE_PRESETS.find((preset) => preset.id === id) ?? null;

// Known actual size per system, matched on the platform's name/abbreviation.
// Systems with no physical case (PC, Steam, digital stores) intentionally
// have NO default — their size is picked per platform in the template dialog.
const NAME_RULES: { match: RegExp; presetId: string }[] = [
  { match: /switch/, presetId: "switch" },
  { match: /playstation 5|playstation 4|playstation 3|xbox one|xbox series/, presetId: "bluray" },
  { match: /nintendo 3ds/, presetId: "n3ds" },
  { match: /nintendo ds/, presetId: "ds" },
  { match: /playstation portable/, presetId: "psp" },
  { match: /vita/, presetId: "vita" },
  { match: /playstation 2|xbox 360|wii|gamecube/, presetId: "dvd" },
  { match: /^xbox$/, presetId: "dvd" },
  { match: /mega drive|genesis|master system/, presetId: "genesis" },
  { match: /sega saturn/, presetId: "saturn" },
  { match: /^playstation$/, presetId: "jewel" },
  { match: /dreamcast|sega cd|turbografx|pc engine/, presetId: "jewel" },
  { match: /entertainment system/, presetId: "nesbox" },
  { match: /super nintendo|super famicom/, presetId: "snesbox" },
  { match: /nintendo 64/, presetId: "n64box" },
  { match: /game boy/, presetId: "gbbox" },
  { match: /atari/, presetId: "atari" },
  { match: /neo geo/, presetId: "neogeo" },
];

const ABBREVIATION_RULES: Record<string, string> = {
  PS5: "bluray",
  PS4: "bluray",
  PS3: "bluray",
  PS2: "dvd",
  PS1: "jewel",
  PSP: "psp",
  PSVITA: "vita",
  PSV: "vita",
  GC: "dvd",
  NGC: "dvd",
  XONE: "bluray",
  XSX: "bluray",
  X360: "dvd",
  GEN: "genesis",
  MD: "genesis",
  SMS: "genesis",
  SAT: "saturn",
  DC: "jewel",
  NES: "nesbox",
  SNES: "snesbox",
  N64: "n64box",
  GB: "gbbox",
  GBC: "gbbox",
  GBA: "gbbox",
  DS: "ds",
  "3DS": "n3ds",
};

export interface PlatformSizeSource {
  name: string;
  abbreviation?: string | null;
  caseHeightMm?: number | null;
  caseSpineMm?: number | null;
}

export function defaultCaseSizeForPlatform(platform: PlatformSizeSource): CaseSizePreset | null {
  const name = platform.name.toLowerCase();
  for (const rule of NAME_RULES) {
    if (rule.match.test(name)) return presetById(rule.presetId);
  }
  const abbreviation = (platform.abbreviation ?? "").toUpperCase();
  const presetId = ABBREVIATION_RULES[abbreviation];
  return presetId ? presetById(presetId) : null;
}

// The size that actually applies: the user's per-platform choice first, then
// the known size for the system, else null (no fixed size for this platform).
export function effectiveCaseSizeMm(
  platform: PlatformSizeSource
): { heightMm: number; spineMm: number } | null {
  if (platform.caseHeightMm != null && platform.caseSpineMm != null) {
    return { heightMm: platform.caseHeightMm, spineMm: platform.caseSpineMm };
  }
  const preset = defaultCaseSizeForPlatform(platform);
  return preset ? { heightMm: preset.heightMm, spineMm: preset.spineMm } : null;
}

export function presetForDimensions(heightMm: number, spineMm: number): CaseSizePreset | null {
  return (
    CASE_SIZE_PRESETS.find(
      (preset) => preset.heightMm === heightMm && preset.spineMm === spineMm
    ) ?? null
  );
}
