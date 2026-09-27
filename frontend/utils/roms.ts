import type { LibraryItem, LibraryStatus, MediaFormat } from "../api/types";

// Mirrors rom_service.can_hold_rom (backend/app/services/rom_service.py) — only decides
// whether to *show* the upload field; the backend enforces the real rule.
const ROM_CAPABLE_FORMATS: MediaFormat[] = ["rom", "abandonware", "iso"];

export function canHoldRom(status: LibraryStatus, format: MediaFormat | null | undefined): boolean {
  return status === "owned" && format != null && ROM_CAPABLE_FORMATS.includes(format);
}

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

export function hasPlayableRom(items: LibraryItem[] | undefined): boolean {
  return (items ?? []).some((item) => item.status === "owned" && item.rom?.playable === true);
}
