import { apiClient } from "./client";
import type { DeviceDetail, DeviceInput, DeviceSummary, LibraryStatus } from "./types";

export interface DeviceListParams {
  search?: string;
  manufacturerId?: number;
  deviceTypeId?: number;
  hardwarePlatformId?: number;
  status?: LibraryStatus;
}

export async function listDevices(params: DeviceListParams = {}): Promise<DeviceSummary[]> {
  const response = await apiClient.get<DeviceSummary[]>("/api/devices", { params });
  return response.data;
}

export async function getDevice(identifier: string): Promise<DeviceDetail> {
  const response = await apiClient.get<DeviceDetail>(`/api/devices/${identifier}`);
  return response.data;
}

export async function createDevice(input: DeviceInput): Promise<DeviceDetail> {
  const response = await apiClient.post<DeviceDetail>("/api/devices", input);
  return response.data;
}

export async function updateDevice(deviceId: number, input: Partial<DeviceInput>): Promise<DeviceDetail> {
  const response = await apiClient.patch<DeviceDetail>(`/api/devices/${deviceId}`, input);
  return response.data;
}

export async function deleteDevice(deviceId: number): Promise<void> {
  await apiClient.delete(`/api/devices/${deviceId}`);
}
