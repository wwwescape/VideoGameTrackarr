// Store page links come from IGDB and are usually the US store (`en-us`). PlayStation and Xbox
// both put the store's locale first in the URL path, so a link can be pointed at another
// country's store by swapping that one segment. Steam, Nintendo, Epic and GOG links are left
// alone: Steam/Epic/GOG pick the region from the visitor's account, and Nintendo's regional
// eShops use different sites and product addresses.

export type StoreWithRegions = "playstation" | "xbox";

interface StoreLocales {
  playstation: string;
  xbox: string;
}

interface StoreRegion extends StoreLocales {
  // A second locale the stores offer in that country, used when it matches VGT's own
  // language (e.g. French in Canada).
  byLanguage?: Partial<Record<string, StoreLocales>>;
}

// Every pair below was checked against the live stores (2026-10-11): a supported locale
// returns 200, an unsupported one redirects elsewhere. Note the exceptions to the obvious
// language-country pairs: PlayStation serves Czechia/Greece/Hungary in English, and Xbox
// serves Saudi Arabia/UAE in Arabic.
export const STORE_REGIONS: Record<string, StoreRegion> = {
  AE: { playstation: "en-ae", xbox: "ar-AE" },
  AR: { playstation: "es-ar", xbox: "es-AR" },
  AT: { playstation: "de-at", xbox: "de-AT" },
  AU: { playstation: "en-au", xbox: "en-AU" },
  BE: { playstation: "fr-be", xbox: "fr-BE" },
  BR: { playstation: "pt-br", xbox: "pt-BR" },
  CA: { playstation: "en-ca", xbox: "en-CA", byLanguage: { fr: { playstation: "fr-ca", xbox: "fr-CA" } } },
  CH: { playstation: "de-ch", xbox: "de-CH", byLanguage: { fr: { playstation: "fr-ch", xbox: "fr-CH" } } },
  CL: { playstation: "es-cl", xbox: "es-CL" },
  CO: { playstation: "es-co", xbox: "es-CO" },
  CZ: { playstation: "en-cz", xbox: "cs-CZ" },
  DE: { playstation: "de-de", xbox: "de-DE" },
  DK: { playstation: "da-dk", xbox: "da-DK" },
  ES: { playstation: "es-es", xbox: "es-ES" },
  FI: { playstation: "fi-fi", xbox: "fi-FI" },
  FR: { playstation: "fr-fr", xbox: "fr-FR" },
  GB: { playstation: "en-gb", xbox: "en-GB" },
  GR: { playstation: "en-gr", xbox: "el-GR" },
  HK: { playstation: "zh-hant-hk", xbox: "zh-HK", byLanguage: { en: { playstation: "en-hk", xbox: "en-HK" } } },
  HU: { playstation: "en-hu", xbox: "hu-HU" },
  IE: { playstation: "en-ie", xbox: "en-IE" },
  IL: { playstation: "en-il", xbox: "he-IL" },
  IN: { playstation: "en-in", xbox: "en-IN" },
  IT: { playstation: "it-it", xbox: "it-IT" },
  JP: { playstation: "ja-jp", xbox: "ja-JP" },
  KR: { playstation: "ko-kr", xbox: "ko-KR" },
  MX: { playstation: "es-mx", xbox: "es-MX" },
  NL: { playstation: "nl-nl", xbox: "nl-NL" },
  NO: { playstation: "no-no", xbox: "nb-NO" },
  NZ: { playstation: "en-nz", xbox: "en-NZ" },
  PL: { playstation: "pl-pl", xbox: "pl-PL" },
  PT: { playstation: "pt-pt", xbox: "pt-PT" },
  SA: { playstation: "en-sa", xbox: "ar-SA" },
  SE: { playstation: "sv-se", xbox: "sv-SE" },
  SG: { playstation: "en-sg", xbox: "en-SG" },
  TR: { playstation: "tr-tr", xbox: "tr-TR" },
  TW: { playstation: "zh-hant-tw", xbox: "zh-TW" },
  US: { playstation: "en-us", xbox: "en-US" },
  ZA: { playstation: "en-za", xbox: "en-ZA" },
};

export const STORE_REGION_AUTO = "auto";
export const STORE_REGION_OFF = "off";

// A store locale segment: "en-us", "en-IN", "zh-hant-hk".
const LOCALE_SEGMENT = /^[a-z]{2}(-[a-z]{4})?-[a-z]{2}$/i;

const STORE_HOSTS: Record<StoreWithRegions, ReadonlySet<string>> = {
  playstation: new Set(["store.playstation.com"]),
  xbox: new Set(["www.xbox.com", "xbox.com"]),
};

/** The first supported country in the browser's preferred languages (e.g. "en-IN" → "IN"). */
export function detectBrowserStoreRegion(languages: readonly string[]): string | null {
  for (const language of languages) {
    const parts = language.split("-");
    const country = parts[parts.length - 1]?.toUpperCase();
    if (language.includes("-") && country && country in STORE_REGIONS) return country;
  }
  return null;
}

/** The setting ("auto", "off" or a country code) as the country to use, or null for "leave links alone". */
export function resolveStoreRegion(setting: string, browserLanguages: readonly string[]): string | null {
  if (setting === STORE_REGION_OFF) return null;
  if (setting === STORE_REGION_AUTO) return detectBrowserStoreRegion(browserLanguages);
  return setting in STORE_REGIONS ? setting : null;
}

function localeFor(store: StoreWithRegions, region: string, appLanguage: string): string | null {
  const entry = STORE_REGIONS[region];
  if (!entry) return null;
  return (entry.byLanguage?.[appLanguage] ?? entry)[store];
}

/** Points a PlayStation Store or Xbox link at `region`'s store; any other URL comes back unchanged. */
export function localiseStoreUrl(
  url: string,
  store: StoreWithRegions,
  region: string | null,
  appLanguage: string
): string {
  if (!region) return url;
  const locale = localeFor(store, region, appLanguage);
  if (!locale) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!STORE_HOSTS[store].has(parsed.hostname.toLowerCase())) return url;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length > 0 && LOCALE_SEGMENT.test(segments[0])) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  const trailingSlash = parsed.pathname.endsWith("/") ? "/" : "";
  parsed.pathname = `/${segments.join("/")}${trailingSlash}`;
  return parsed.toString();
}
