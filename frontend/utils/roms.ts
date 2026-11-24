import type { LibraryItem, LibraryStatus, MediaFormat } from "../api/types";

// Mirrors rom_service.can_hold_rom (backend/app/services/rom_service.py) — only decides
// whether to *show* the upload field; the backend enforces the real rule.
const ROM_CAPABLE_FORMATS: MediaFormat[] = ["rom", "abandonware", "iso"];

export function canHoldRom(status: LibraryStatus, format: MediaFormat | null | undefined): boolean {
  return status === "owned" && format != null && ROM_CAPABLE_FORMATS.includes(format);
}

// Shared with Guides & Cheats; re-exported here so existing imports keep working.
export { fileExtension, formatFileSize } from "./fileSize";

export function hasPlayableRom(items: LibraryItem[] | undefined): boolean {
  return (items ?? []).some((item) => item.status === "owned" && item.roms.some((rom) => rom.playable));
}

// The cross-origin-isolated player page (frontend/player-isolated.html) DOS and PSP play in —
// it starts its own play session for the ROM, so only ids and a title travel in the URL.
export function isolatedPlayerUrl(romId: number, resumeStateId: number | null, title: string): string {
  const params = new URLSearchParams({ rom: String(romId), title });
  if (resumeStateId != null) params.set("resume", String(resumeStateId));
  return `${import.meta.env.BASE_URL}player-isolated.html?${params.toString()}`;
}
