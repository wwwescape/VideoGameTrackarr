import type { TFunction } from "i18next";
import epicGamesLogo from "../assets/epic-games-logo.png";
import gogLogo from "../assets/gog.com-logo.png";
import steamLogo from "../assets/steam-logo.png";
import type { MediaFormat } from "../api/types";

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

// "PC · Steam" for a scoped card, otherwise the platform's own name.
export function platformDisplayName(
  platform: { name: string; abbreviation: string | null },
  scope: PlatformScope,
  t: TFunction
): string {
  const label = platformScopeLabel(scope, t);
  return label ? `${platform.abbreviation || platform.name} · ${label}` : platform.name;
}

const STOREFRONT_LOGOS: Record<string, string> = {
  Steam: steamLogo,
  GOG: gogLogo,
  "Epic Games Store": epicGamesLogo,
};

export function storefrontLogoUrl(storefront: string | undefined): string | undefined {
  return storefront ? STOREFRONT_LOGOS[storefront] : undefined;
}
