import { apiClient } from "./client";
import type {
  BiosSystem,
  EmulationConfig,
  EmulatorSession,
  LibraryItem,
  LibraryItemInput,
  LibraryStatus,
  SaveState,
} from "./types";

export async function listLibraryItems(gameId: number, status?: LibraryStatus): Promise<LibraryItem[]> {
  const response = await apiClient.get<LibraryItem[]>(`/api/games/${gameId}/library`, {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function addLibraryItem(gameId: number, input: LibraryItemInput): Promise<LibraryItem> {
  const response = await apiClient.post<LibraryItem>(`/api/games/${gameId}/library`, input);
  return response.data;
}

export async function updateLibraryItem(
  itemId: number,
  input: Partial<LibraryItemInput>
): Promise<LibraryItem> {
  const response = await apiClient.put<LibraryItem>(`/api/library/${itemId}`, input);
  return response.data;
}

export async function deleteLibraryItem(itemId: number): Promise<void> {
  await apiClient.delete(`/api/library/${itemId}`);
}

function progressHandler(onProgress?: (fraction: number) => void) {
  return {
    onUploadProgress: (event: { loaded: number; total?: number }) => {
      if (onProgress && event.total) {
        onProgress(event.loaded / event.total);
      }
    },
  };
}

// Adds one more ROM to a copy (a copy can hold several, e.g. regions or revisions).
export async function addRom(
  itemId: number,
  file: File,
  label: string | null,
  onProgress?: (fraction: number) => void
): Promise<LibraryItem> {
  const form = new FormData();
  form.append("file", file);
  if (label) form.append("label", label);
  const response = await apiClient.post<LibraryItem>(`/api/library/${itemId}/roms`, form, progressHandler(onProgress));
  return response.data;
}

// Swaps a ROM's file, keeping its label; the backend deletes that ROM's saves.
export async function replaceRom(
  romId: number,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<LibraryItem> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.put<LibraryItem>(`/api/roms/${romId}`, form, progressHandler(onProgress));
  return response.data;
}

export async function updateRomLabel(romId: number, label: string | null): Promise<LibraryItem> {
  const response = await apiClient.patch<LibraryItem>(`/api/roms/${romId}`, { label });
  return response.data;
}

// A short-lived signed link to the ROM's original file (served as an attachment).
export async function createRomDownloadLink(romId: number): Promise<string> {
  const response = await apiClient.post<{ url: string }>(`/api/roms/${romId}/download-link`);
  return response.data.url;
}

export async function deleteRom(romId: number): Promise<void> {
  await apiClient.delete(`/api/roms/${romId}`);
}

export async function listBiosSystems(): Promise<BiosSystem[]> {
  const response = await apiClient.get<BiosSystem[]>("/api/emulation/bios");
  return response.data;
}

export async function uploadBios(system: string, file: File): Promise<BiosSystem> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<BiosSystem>(`/api/emulation/bios/${system}`, form);
  return response.data;
}

export async function deleteBios(biosId: number): Promise<void> {
  await apiClient.delete(`/api/emulation/bios/${biosId}`);
}

export async function createPlaySession(romId: number): Promise<EmulatorSession> {
  const response = await apiClient.post<EmulatorSession>(`/api/roms/${romId}/play-session`);
  return response.data;
}

export async function getEmulationConfig(): Promise<EmulationConfig> {
  const response = await apiClient.get<EmulationConfig>("/api/emulation");
  return response.data;
}

// --- Save states + in-game saves (called by the page hosting the player, not the iframe) ---

export async function listSaveStates(romId: number): Promise<SaveState[]> {
  const response = await apiClient.get<SaveState[]>(`/api/roms/${romId}/states`);
  return response.data;
}

export async function createSaveState(romId: number, state: Blob, screenshot?: Blob | null): Promise<SaveState> {
  const form = new FormData();
  form.append("state", state, "game.state");
  if (screenshot) {
    form.append("screenshot", screenshot, "screenshot");
  }
  const response = await apiClient.post<SaveState>(`/api/roms/${romId}/states`, form);
  return response.data;
}

export async function deleteSaveState(romId: number, stateId: number): Promise<void> {
  await apiClient.delete(`/api/roms/${romId}/states/${stateId}`);
}

export async function getSaveStateData(romId: number, stateId: number): Promise<ArrayBuffer> {
  const response = await apiClient.get<ArrayBuffer>(`/api/roms/${romId}/states/${stateId}/data`, {
    responseType: "arraybuffer",
  });
  return response.data;
}

export function saveStateScreenshotPath(romId: number, stateId: number): string {
  return `/api/roms/${romId}/states/${stateId}/screenshot`;
}

// null when the ROM has no in-game save yet (404), rather than throwing.
export async function getInGameSave(romId: number): Promise<ArrayBuffer | null> {
  const response = await apiClient.get<ArrayBuffer>(`/api/roms/${romId}/sram`, {
    responseType: "arraybuffer",
    validateStatus: (status) => status === 200 || status === 404,
  });
  return response.status === 404 ? null : response.data;
}

export async function putInGameSave(romId: number, save: Blob): Promise<void> {
  const form = new FormData();
  form.append("save", save, "game.sav");
  await apiClient.put(`/api/roms/${romId}/sram`, form);
}
