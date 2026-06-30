import { apiClient } from "./client";
import type { Note } from "./types";

export async function listNotes(gameId: number): Promise<Note[]> {
  const response = await apiClient.get<Note[]>(`/api/games/${gameId}/notes`);
  return response.data;
}

export async function createNote(gameId: number, body: string): Promise<Note> {
  const response = await apiClient.post<Note>(`/api/games/${gameId}/notes`, { body });
  return response.data;
}

export async function updateNote(noteId: number, body: string): Promise<Note> {
  const response = await apiClient.put<Note>(`/api/notes/${noteId}`, { body });
  return response.data;
}

export async function deleteNote(noteId: number): Promise<void> {
  await apiClient.delete(`/api/notes/${noteId}`);
}
