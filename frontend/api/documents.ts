import { apiClient } from "./client";
import type { DocumentChanges, DocumentEntry, DocumentKind, GuideUploadOptions } from "./types";
import { progressHandler } from "./uploadProgress";

// Documents on any owner: a game's Guides & Cheats (backend/app/api/routes/guides.py), and a
// device's, accessory's or Toys-to-Life pack's Manuals & Documents
// (backend/app/api/routes/hardware_documents.py, toys_to_life_documents.py).

export type DocumentOwnerType = "game" | "device" | "accessory" | "toysToLife";

export interface DocumentOwner {
  type: DocumentOwnerType;
  id: number;
}

interface OwnerPaths {
  // GET the list; POST `${collection}/file` and `${collection}/link` to add.
  collection: string;
  // One entry: PATCH/DELETE `${entry}/${id}`, PUT `${entry}/${id}/file`, POST its links.
  entry: string;
}

export function ownerPaths(owner: DocumentOwner): OwnerPaths {
  switch (owner.type) {
    case "game":
      return { collection: `/api/games/${owner.id}/guides`, entry: "/api/guides" };
    case "device":
      return { collection: `/api/devices/${owner.id}/documents`, entry: "/api/hardware-documents" };
    case "accessory":
      return {
        collection: `/api/accessories/${owner.id}/documents`,
        entry: "/api/hardware-documents",
      };
    case "toysToLife":
      return {
        collection: `/api/toys-to-life/items/${owner.id}/documents`,
        entry: "/api/toys-to-life-documents",
      };
  }
}

export interface DocumentFields {
  kind: DocumentKind;
  name?: string | null;
  // Games only.
  platformId?: number | null;
  copyId?: number | null;
}

// Every document type accepts the same files, with the same size limit.
export async function getDocumentUploadOptions(): Promise<GuideUploadOptions> {
  const response = await apiClient.get<GuideUploadOptions>("/api/guides/upload-options");
  return response.data;
}

export async function listDocuments(owner: DocumentOwner): Promise<DocumentEntry[]> {
  const response = await apiClient.get<DocumentEntry[]>(ownerPaths(owner).collection);
  return response.data;
}

export async function createDocumentFile(
  owner: DocumentOwner,
  file: File,
  fields: DocumentFields,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<DocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", fields.kind);
  if (fields.name) form.append("name", fields.name);
  if (fields.platformId != null) form.append("platform_id", String(fields.platformId));
  if (fields.copyId != null) form.append("copy_id", String(fields.copyId));
  const response = await apiClient.post<DocumentEntry>(
    `${ownerPaths(owner).collection}/file`,
    form,
    {
      ...progressHandler(onProgress),
      signal,
    }
  );
  return response.data;
}

export async function createDocumentLink(
  owner: DocumentOwner,
  url: string,
  fields: DocumentFields
): Promise<DocumentEntry> {
  const body: Record<string, unknown> = {
    url,
    kind: fields.kind,
    name: fields.name || null,
    copyId: fields.copyId ?? null,
  };
  if (owner.type === "game") body.platformId = fields.platformId ?? null;
  const response = await apiClient.post<DocumentEntry>(
    `${ownerPaths(owner).collection}/link`,
    body
  );
  return response.data;
}

// Only the keys present change; `platformId`/`copyId: null` clears it; `url` on a file entry
// turns it into a link (the server deletes its file).
export async function updateDocument(
  owner: DocumentOwner,
  documentId: number,
  changes: DocumentChanges
): Promise<DocumentEntry> {
  const response = await apiClient.patch<DocumentEntry>(
    `${ownerPaths(owner).entry}/${documentId}`,
    changes
  );
  return response.data;
}

// Swaps in a new file — on a file entry, or turning a link into a file.
export async function replaceDocumentFile(
  owner: DocumentOwner,
  documentId: number,
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<DocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.put<DocumentEntry>(
    `${ownerPaths(owner).entry}/${documentId}/file`,
    form,
    { ...progressHandler(onProgress), signal }
  );
  return response.data;
}

export async function deleteDocument(owner: DocumentOwner, documentId: number): Promise<void> {
  await apiClient.delete(`${ownerPaths(owner).entry}/${documentId}`);
}

// Short-lived signed links: "view" shows the file (rendered page, text, PDF or image) inline;
// "download" hands back the original as an attachment.
export async function createDocumentViewLink(
  owner: DocumentOwner,
  documentId: number
): Promise<string> {
  const response = await apiClient.post<{ url: string }>(
    `${ownerPaths(owner).entry}/${documentId}/view-link`
  );
  return response.data.url;
}

export async function createDocumentDownloadLink(
  owner: DocumentOwner,
  documentId: number
): Promise<string> {
  const response = await apiClient.post<{ url: string }>(
    `${ownerPaths(owner).entry}/${documentId}/download-link`
  );
  return response.data.url;
}
