import { apiClient } from "./client";
import type {
  LibraryStatus,
  Tag,
  ToysToLifeCopy,
  ToysToLifeGameSection,
  ToysToLifeItemDetail,
  ToysToLifeItemSummary,
  ToysToLifeLine,
  ToysToLifeNote,
} from "./types";

export async function listToysToLifeLines(): Promise<ToysToLifeLine[]> {
  const response = await apiClient.get<ToysToLifeLine[]>("/api/toys-to-life/lines");
  return response.data;
}

export async function listToysToLifeItems(line: string): Promise<ToysToLifeItemSummary[]> {
  const response = await apiClient.get<ToysToLifeItemSummary[]>(`/api/toys-to-life/lines/${line}/items`);
  return response.data;
}

export async function getToysToLifeItem(line: string, setNumber: string): Promise<ToysToLifeItemDetail> {
  const response = await apiClient.get<ToysToLifeItemDetail>(`/api/toys-to-life/lines/${line}/items/${setNumber}`);
  return response.data;
}

// null for a game that isn't a line's base game.
export async function getToysToLifeGameSection(gameId: number): Promise<ToysToLifeGameSection | null> {
  const response = await apiClient.get<ToysToLifeGameSection | null>(`/api/toys-to-life/games/${gameId}`);
  return response.data;
}

export interface ToysToLifeCopyInput {
  status: LibraryStatus;
  price: number | null;
  notes: string | null;
}

export async function createToysToLifeCopy(itemId: number, input: ToysToLifeCopyInput): Promise<ToysToLifeCopy> {
  const response = await apiClient.post<ToysToLifeCopy>(`/api/toys-to-life/items/${itemId}/copies`, input);
  return response.data;
}

// Only the fields sent change (Move to Wishlist sends just the status).
export async function updateToysToLifeCopy(copyId: number, input: Partial<ToysToLifeCopyInput>): Promise<ToysToLifeCopy> {
  const response = await apiClient.put<ToysToLifeCopy>(`/api/toys-to-life/copies/${copyId}`, input);
  return response.data;
}

export async function deleteToysToLifeCopy(copyId: number): Promise<void> {
  await apiClient.delete(`/api/toys-to-life/copies/${copyId}`);
}

export async function setToysToLifeRating(itemId: number, rating: number | null): Promise<number | null> {
  const response = await apiClient.put<{ rating: number | null }>(`/api/toys-to-life/items/${itemId}/rating`, { rating });
  return response.data.rating;
}

export async function listToysToLifeNotes(itemId: number): Promise<ToysToLifeNote[]> {
  const response = await apiClient.get<ToysToLifeNote[]>(`/api/toys-to-life/items/${itemId}/notes`);
  return response.data;
}

export async function createToysToLifeNote(itemId: number, body: string): Promise<ToysToLifeNote> {
  const response = await apiClient.post<ToysToLifeNote>(`/api/toys-to-life/items/${itemId}/notes`, { body });
  return response.data;
}

export async function updateToysToLifeNote(noteId: number, body: string): Promise<ToysToLifeNote> {
  const response = await apiClient.put<ToysToLifeNote>(`/api/toys-to-life/notes/${noteId}`, { body });
  return response.data;
}

export async function deleteToysToLifeNote(noteId: number): Promise<void> {
  await apiClient.delete(`/api/toys-to-life/notes/${noteId}`);
}

export async function attachTagToToy(itemId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.post<Tag[]>(`/api/toys-to-life/items/${itemId}/tags/${tagId}`);
  return response.data;
}

export async function detachTagFromToy(itemId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.delete<Tag[]>(`/api/toys-to-life/items/${itemId}/tags/${tagId}`);
  return response.data;
}
