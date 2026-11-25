import type { TFunction } from "i18next";
import type { DocumentOwner, DocumentOwnerType } from "../api/documents";
import type {
  DocumentEntry,
  DocumentKind,
  GuideUploadOptions,
  LibraryItem,
  MediaFormat,
  PlatformResponse,
} from "../api/types";
import { CONDITION_LABELS } from "./hardwareLabels";
import { fileExtension } from "./fileSize";

// Client-side helpers for documents (Guides & Cheats, Manuals & Documents). The file checks only
// save a pointless upload and give a translated message; backend/app/services/document_files.py
// makes the real decision.

const HTML_EXTENSIONS = ["html", "htm", "xhtml", "mht", "mhtml"];
export const FALLBACK_EXTENSIONS = [
  "pdf",
  "docx",
  "md",
  "markdown",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
];

// The guides.errors.* key for a file that won't be accepted, or null if it looks fine.
export function guideFileError(
  file: File,
  options: GuideUploadOptions | undefined
): "html" | "doc" | "svg" | "heic" | "unsupported" | "tooLarge" | null {
  const extension = fileExtension(file.name);
  if (HTML_EXTENSIONS.includes(extension)) return "html";
  if (extension === "doc") return "doc";
  if (extension === "svg" || extension === "svgz") return "svg";
  if (extension === "heic" || extension === "heif") return "heic";
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

// The types each owner offers, in the order rows are listed (the servers sort the same way).
export const DOCUMENT_KINDS: Record<DocumentOwnerType, DocumentKind[]> = {
  game: ["guide", "cheat", "manual", "receipt", "other"],
  device: ["manual", "quick_start", "receipt", "warranty", "repair", "other"],
  accessory: ["manual", "quick_start", "receipt", "warranty", "repair", "other"],
  toysToLife: ["manual", "receipt", "other"],
};

// What the reader remembers your place under. A game's guides keep their original keys (the
// bare id); devices and accessories share one table, Toys-to-Life packs have their own.
export function documentPositionKey(owner: DocumentOwner, documentId: number): string {
  if (owner.type === "game") return String(documentId);
  return `${owner.type === "toysToLife" ? "toysToLife" : "hardware"}-${documentId}`;
}

// The address hash the reader is open on: #guides/<id> on a game, #documents/<id> elsewhere.
export function documentHashPrefix(owner: DocumentOwner): string {
  return owner.type === "game" ? "guides" : "documents";
}

const FORMAT_KEYS: Record<MediaFormat, string> = {
  physical: "games.library.formatPhysical",
  digital: "games.library.formatDigital",
  iso: "games.library.formatIso",
  rom: "games.library.formatRom",
  abandonware: "games.library.formatAbandonware",
  other: "games.library.formatOther",
};

// How a row or the Copy picker names an owned copy: a game copy by its platform and format, a
// device or accessory by its serial number, else its condition, else "Copy N".
export function copyLabel(
  t: TFunction,
  copy: {
    number: number | null;
    platformName?: string | null;
    format?: MediaFormat | null;
    serialNumber?: string | null;
    condition?: DocumentEntry["copyCondition"];
  }
): string {
  if (copy.serialNumber) return t("documents.copySerial", { serial: copy.serialNumber });
  if (copy.condition) return CONDITION_LABELS[copy.condition];
  const formatKey = copy.format ? FORMAT_KEYS[copy.format] : undefined;
  const parts = [copy.platformName, formatKey ? t(formatKey) : null].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return t("documents.copyNumber", { number: copy.number ?? 1 });
}

// A row's copy, when it names one.
export function entryCopyLabel(t: TFunction, entry: DocumentEntry): string | null {
  if (entry.copyId == null) return null;
  return copyLabel(t, {
    number: entry.copyNumber,
    platformName: entry.copyPlatformName,
    format: entry.copyFormat,
    serialNumber: entry.copySerialNumber,
    condition: entry.copyCondition,
  });
}

// The Copy picker's choices, numbered by age ("Copy 2" is the second one added). Two copies that
// would read the same (two PS2 physical copies) get their number added.
export function copyOptions(
  t: TFunction,
  copies: {
    id: number;
    platformName?: string | null;
    format?: MediaFormat | null;
    serialNumber?: string | null;
    condition?: DocumentEntry["copyCondition"];
  }[]
): { id: number; label: string }[] {
  const sorted = [...copies].sort((a, b) => a.id - b.id);
  const labels = sorted.map((copy, index) => copyLabel(t, { ...copy, number: index + 1 }));
  return sorted.map((copy, index) => {
    const label = labels[index];
    const repeated = labels.filter((other) => other === label).length > 1;
    return {
      id: copy.id,
      label: repeated ? `${label} · ${t("documents.copyNumber", { number: index + 1 })}` : label,
    };
  });
}
