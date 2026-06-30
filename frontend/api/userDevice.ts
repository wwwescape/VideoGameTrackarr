import { apiClient } from "./client";
import type { LibraryStatus, UserDevice, UserDeviceInput } from "./types";

export async function listUserDevices(deviceId: number, status?: LibraryStatus): Promise<UserDevice[]> {
  const response = await apiClient.get<UserDevice[]>(`/api/devices/${deviceId}/user-devices`, {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function addUserDevice(deviceId: number, input: UserDeviceInput): Promise<UserDevice> {
  const response = await apiClient.post<UserDevice>(`/api/devices/${deviceId}/user-devices`, input);
  return response.data;
}

export async function updateUserDevice(itemId: number, input: Partial<UserDeviceInput>): Promise<UserDevice> {
  const response = await apiClient.patch<UserDevice>(`/api/user-devices/${itemId}`, input);
  return response.data;
}

export async function deleteUserDevice(itemId: number): Promise<void> {
  await apiClient.delete(`/api/user-devices/${itemId}`);
}
