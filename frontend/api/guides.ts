import { apiClient } from "./client";
import type { Guide, GuideChanges, GuideKind, GuideUploadOptions } from "./types";
import { progressHandler } from "./uploadProgress";

// Guides & Cheats (backend/app/api/routes/guides.py).

export interface GuideFileFields {
  kind: GuideKind;
  name?: string | null;
  platformId?: number | null;
}

export async function getGuideUploadOptions(): Promise<GuideUploadOptions> {
  const response = await apiClient.get<GuideUploadOptions>("/api/guides/upload-options");
  return response.data;
}

export async function listGuides(gameId: number): Promise<Guide[]> {
  const response = await apiClient.get<Guide[]>(`/api/games/${gameId}/guides`);
  return response.data;
}

export async function createGuideFile(
  gameId: number,
  file: File,
  fields: GuideFileFields,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<Guide> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", fields.kind);
  if (fields.name) form.append("name", fields.name);
  if (fields.platformId != null) form.append("platform_id", String(fields.platformId));
  const response = await apiClient.post<Guide>(`/api/games/${gameId}/guides/file`, form, {
    ...progressHandler(onProgress),
    signal,
  });
  return response.data;
}

export async function createGuideLink(
  gameId: number,
  url: string,
  fields: GuideFileFields
): Promise<Guide> {
  const response = await apiClient.post<Guide>(`/api/games/${gameId}/guides/link`, {
    url,
    kind: fields.kind,
    name: fields.name || null,
    platformId: fields.platformId ?? null,
  });
  return response.data;
}

// Only the keys present change; `platformId: null` clears it; `url` on a file entry turns it
// into a link (the server deletes its file).
export async function updateGuide(guideId: number, changes: GuideChanges): Promise<Guide> {
  const response = await apiClient.patch<Guide>(`/api/guides/${guideId}`, changes);
  return response.data;
}

// Swaps in a new file — on a file entry, or turning a link into a file.
export async function replaceGuideFile(
  guideId: number,
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<Guide> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.put<Guide>(`/api/guides/${guideId}/file`, form, {
    ...progressHandler(onProgress),
    signal,
  });
  return response.data;
}

export async function deleteGuide(guideId: number): Promise<void> {
  await apiClient.delete(`/api/guides/${guideId}`);
}

// Short-lived signed links: "view" shows the file (rendered page, text or PDF) inline;
// "download" hands back the original as an attachment.
export async function createGuideViewLink(guideId: number): Promise<string> {
  const response = await apiClient.post<{ url: string }>(`/api/guides/${guideId}/view-link`);
  return response.data.url;
}

export async function createGuideDownloadLink(guideId: number): Promise<string> {
  const response = await apiClient.post<{ url: string }>(`/api/guides/${guideId}/download-link`);
  return response.data.url;
}
