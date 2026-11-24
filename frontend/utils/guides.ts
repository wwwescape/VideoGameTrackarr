import type { GuideUploadOptions, LibraryItem, PlatformResponse } from "../api/types";
import { fileExtension } from "./fileSize";

// Client-side checks for Guides & Cheats. They only save a pointless upload and give a
// translated message; backend/app/services/guide_service.py makes the real decision.

const HTML_EXTENSIONS = ["html", "htm", "xhtml", "mht", "mhtml"];
export const FALLBACK_EXTENSIONS = ["pdf", "docx", "md", "markdown", "txt"];

// The guides.errors.* key for a file that won't be accepted, or null if it looks fine.
export function guideFileError(
  file: File,
  options: GuideUploadOptions | undefined
): "html" | "doc" | "unsupported" | "tooLarge" | null {
  const extension = fileExtension(file.name);
  if (HTML_EXTENSIONS.includes(extension)) return "html";
  if (extension === "doc") return "doc";
  if (!(options?.extensions ?? FALLBACK_EXTENSIONS).includes(extension)) return "unsupported";
  if (options && file.size > options.maxUploadMb * 1024 * 1024) return "tooLarge";
  return null;
}

// The name a file entry gets when none is typed: the file name minus its extension.
export function nameFromFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  return (dot > 0 ? base.slice(0, dot) : base).trim();
}

// A full http(s) link with a host and no username or password, as the server requires.
export function parseGuideLink(value: string): URL | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function domainOf(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}

export interface GuidePlatformOptions {
  owned: { id: number; name: string }[];
  other: { id: number; name: string }[];
}

// The Platform picker: platforms you have copies on first, then the game's other platforms.
export function guidePlatformOptions(
  libraryItems: LibraryItem[] | undefined,
  gamePlatforms: PlatformResponse[] | undefined
): GuidePlatformOptions {
  const owned = new Map<number, string>();
  for (const item of libraryItems ?? []) {
    if (item.platformId != null && !owned.has(item.platformId)) {
      owned.set(item.platformId, item.platformName ?? String(item.platformId));
    }
  }
  const other = (gamePlatforms ?? []).filter((platform) => !owned.has(platform.id));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  return {
    owned: [...owned].map(([id, name]) => ({ id, name })).sort(byName),
    other: other.map(({ id, name }) => ({ id, name })).sort(byName),
  };
}
