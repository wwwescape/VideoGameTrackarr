import { apiClient } from "./client";
import type { LibraryItem, LibraryItemInput, LibraryStatus } from "./types";

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
