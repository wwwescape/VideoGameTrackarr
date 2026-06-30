import { apiClient } from "./client";
import type { DeviceNote } from "./types";

export async function listDeviceNotes(deviceId: number): Promise<DeviceNote[]> {
  const response = await apiClient.get<DeviceNote[]>(`/api/devices/${deviceId}/notes`);
  return response.data;
}

export async function createDeviceNote(deviceId: number, body: string): Promise<DeviceNote> {
  const response = await apiClient.post<DeviceNote>(`/api/devices/${deviceId}/notes`, { body });
  return response.data;
}

export async function updateDeviceNote(noteId: number, body: string): Promise<DeviceNote> {
  const response = await apiClient.put<DeviceNote>(`/api/device-notes/${noteId}`, { body });
  return response.data;
}

export async function deleteDeviceNote(noteId: number): Promise<void> {
  await apiClient.delete(`/api/device-notes/${noteId}`);
}
