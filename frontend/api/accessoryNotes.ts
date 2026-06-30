import { apiClient } from "./client";
import type { AccessoryNote } from "./types";

export async function listAccessoryNotes(accessoryId: number): Promise<AccessoryNote[]> {
  const response = await apiClient.get<AccessoryNote[]>(`/api/accessories/${accessoryId}/notes`);
  return response.data;
}

export async function createAccessoryNote(accessoryId: number, body: string): Promise<AccessoryNote> {
  const response = await apiClient.post<AccessoryNote>(`/api/accessories/${accessoryId}/notes`, { body });
  return response.data;
}

export async function updateAccessoryNote(noteId: number, body: string): Promise<AccessoryNote> {
  const response = await apiClient.put<AccessoryNote>(`/api/accessory-notes/${noteId}`, { body });
  return response.data;
}

export async function deleteAccessoryNote(noteId: number): Promise<void> {
  await apiClient.delete(`/api/accessory-notes/${noteId}`);
}
