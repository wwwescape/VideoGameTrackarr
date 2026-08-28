import { apiClient } from "./client";
import type { Tag } from "./types";

export async function listTags(): Promise<Tag[]> {
  const response = await apiClient.get<Tag[]>("/api/tags");
  return response.data;
}

export async function createTag(name: string, color?: string | null, textColor?: string | null): Promise<Tag> {
  const response = await apiClient.post<Tag>("/api/tags", { name, color, textColor });
  return response.data;
}

export async function updateTag(
  tagId: number,
  name: string,
  color?: string | null,
  textColor?: string | null
): Promise<Tag> {
  const response = await apiClient.patch<Tag>(`/api/tags/${tagId}`, { name, color, textColor });
  return response.data;
}

export async function deleteTag(tagId: number): Promise<void> {
  await apiClient.delete(`/api/tags/${tagId}`);
}

export async function attachTag(gameId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.post<Tag[]>(`/api/games/${gameId}/tags/${tagId}`);
  return response.data;
}

export async function detachTag(gameId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.delete<Tag[]>(`/api/games/${gameId}/tags/${tagId}`);
  return response.data;
}

export async function attachTagToDevice(deviceId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.post<Tag[]>(`/api/devices/${deviceId}/tags/${tagId}`);
  return response.data;
}

export async function detachTagFromDevice(deviceId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.delete<Tag[]>(`/api/devices/${deviceId}/tags/${tagId}`);
  return response.data;
}

export async function attachTagToAccessory(accessoryId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.post<Tag[]>(`/api/accessories/${accessoryId}/tags/${tagId}`);
  return response.data;
}

export async function detachTagFromAccessory(accessoryId: number, tagId: number): Promise<Tag[]> {
  const response = await apiClient.delete<Tag[]>(`/api/accessories/${accessoryId}/tags/${tagId}`);
  return response.data;
}
