import type { TFunction } from "i18next";
import epicGamesLogo from "../assets/services/epic-games.png";
import epicGamesLogoDark from "../assets/services/epic-games-dark.png";
import gogLogo from "../assets/services/gog.png";
import gogLogoDark from "../assets/services/gog-dark.png";
import steamLogo from "../assets/services/steam.png";
import type { MediaFormat } from "../api/types";
import type { LogoMode } from "./platformLogos";

// PC copies are split into one Games → Platforms card per storefront (and per other format,
// e.g. Physical) — see the backend's platform_repository.STOREFRONT_SPLIT_IGDB_PLATFORM_IDS.
// A card's scope travels in its page's query string: ?format=digital&storefront=Steam.
export interface PlatformScope {
  format?: MediaFormat;
  storefront?: string;
}

const FORMAT_LABEL_KEYS: Record<MediaFormat, string> = {
  physical: "games.library.formatPhysical",
  digital: "games.library.formatDigital",
  iso: "games.library.formatIso",
  rom: "games.library.formatRom",
  abandonware: "games.library.formatAbandonware",
  other: "games.library.formatOther",
};

const isMediaFormat = (value: string | null): value is MediaFormat =>
  value !== null && Object.prototype.hasOwnProperty.call(FORMAT_LABEL_KEYS, value);

export function parsePlatformScope(searchParams: URLSearchParams): PlatformScope {
  const format = searchParams.get("format");
  if (!isMediaFormat(format)) return {};
  const storefront = format === "digital" ? searchParams.get("storefront") || undefined : undefined;
  return { format, storefront };
}

export function platformScopeQuery(scope: PlatformScope): string {
  if (!scope.format) return "";
  const params = new URLSearchParams({ format: scope.format });
  if (scope.storefront) params.set("storefront", scope.storefront);
  return `?${params.toString()}`;
}

// "Steam", or the format ("Physical", "Digital" for digital copies with no storefront set).
export function platformScopeLabel(scope: PlatformScope, t: TFunction): string | undefined {
  if (!scope.format) return undefined;
  return scope.storefront ?? t(FORMAT_LABEL_KEYS[scope.format]);
}

// A card as a Games-list filter value (the backend's platformScope param): "<id>" for a whole
// platform, "<id>:<format>:<storefront>" for a PC storefront/format card.
export function platformScopeKey(platformId: number, scope: PlatformScope): string {
  return scope.format ? `${platformId}:${scope.format}:${scope.storefront ?? ""}` : String(platformId);
}

// "PC · Steam" for a scoped card, otherwise the platform's own name.
export function platformDisplayName(
  platform: { name: string; abbreviation: string | null },
  scope: PlatformScope,
  t: TFunction
): string {
  const label = platformScopeLabel(scope, t);
  return label ? `${platform.abbreviation || platform.name} · ${label}` : platform.name;
}

// `dark` only where the regular logo would vanish on the dark theme.
const STOREFRONT_LOGOS: Record<string, { light: string; dark?: string }> = {
  Steam: { light: steamLogo },
  GOG: { light: gogLogo, dark: gogLogoDark },
  "Epic Games Store": { light: epicGamesLogo, dark: epicGamesLogoDark },
};

export function storefrontLogoUrl(storefront: string | undefined, mode: LogoMode = "light"): string | undefined {
  const logo = storefront ? STOREFRONT_LOGOS[storefront] : undefined;
  return logo && (mode === "dark" ? (logo.dark ?? logo.light) : logo.light);
}
