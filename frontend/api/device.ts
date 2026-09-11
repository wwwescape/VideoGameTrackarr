import { apiClient } from "./client";
import type { DeviceDetail, DeviceInput, DeviceSummary, LibraryStatus } from "./types";

export interface DeviceListParams {
  search?: string;
  manufacturerIds?: number[];
  deviceTypeIds?: number[];
  hardwarePlatformIds?: number[];
  status?: LibraryStatus;
}

export async function listDevices(params: DeviceListParams = {}): Promise<DeviceSummary[]> {
  const { search, manufacturerIds, deviceTypeIds, hardwarePlatformIds, status } = params;
  const response = await apiClient.get<DeviceSummary[]>("/api/devices", {
    params: {
      search: search || undefined,
      manufacturerId: manufacturerIds?.length ? manufacturerIds : undefined,
      deviceTypeId: deviceTypeIds?.length ? deviceTypeIds : undefined,
      hardwarePlatformId: hardwarePlatformIds?.length ? hardwarePlatformIds : undefined,
      status,
    },
    // Axios's default array serialization emits `manufacturerId[]=1`, which FastAPI's
    // `list[int]` Query param won't bind under the `manufacturerId` alias — this repeats
    // the bare key instead (`manufacturerId=1&manufacturerId=2`), matching what the backend
    // actually parses (same reasoning as games.ts's listGames).
    paramsSerializer: { indexes: null },
  });
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
