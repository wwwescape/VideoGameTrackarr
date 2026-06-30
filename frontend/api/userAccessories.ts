import { apiClient } from "./client";
import type { LibraryStatus, UserAccessory, UserAccessoryInput } from "./types";

export async function listUserAccessories(accessoryId: number, status?: LibraryStatus): Promise<UserAccessory[]> {
  const response = await apiClient.get<UserAccessory[]>(`/api/accessories/${accessoryId}/user-accessories`, {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function addUserAccessory(accessoryId: number, input: UserAccessoryInput): Promise<UserAccessory> {
  const response = await apiClient.post<UserAccessory>(`/api/accessories/${accessoryId}/user-accessories`, input);
  return response.data;
}

export async function updateUserAccessory(
  itemId: number,
  input: Partial<UserAccessoryInput>
): Promise<UserAccessory> {
  const response = await apiClient.patch<UserAccessory>(`/api/user-accessories/${itemId}`, input);
  return response.data;
}

export async function deleteUserAccessory(itemId: number): Promise<void> {
  await apiClient.delete(`/api/user-accessories/${itemId}`);
}
