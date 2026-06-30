import { apiClient } from "./client";
import type { AccessoryDetail, AccessoryInput, AccessorySummary, LibraryStatus } from "./types";

export interface AccessoryListParams {
  search?: string;
  manufacturerId?: number;
  accessoryTypeId?: number;
  hardwarePlatformId?: number;
  status?: LibraryStatus;
}

export async function listAccessories(params: AccessoryListParams = {}): Promise<AccessorySummary[]> {
  const response = await apiClient.get<AccessorySummary[]>("/api/accessories", { params });
  return response.data;
}

export async function getAccessory(identifier: string): Promise<AccessoryDetail> {
  const response = await apiClient.get<AccessoryDetail>(`/api/accessories/${identifier}`);
  return response.data;
}

export async function createAccessory(input: AccessoryInput): Promise<AccessoryDetail> {
  const response = await apiClient.post<AccessoryDetail>("/api/accessories", input);
  return response.data;
}

export async function updateAccessory(accessoryId: number, input: Partial<AccessoryInput>): Promise<AccessoryDetail> {
  const response = await apiClient.patch<AccessoryDetail>(`/api/accessories/${accessoryId}`, input);
  return response.data;
}

export async function deleteAccessory(accessoryId: number): Promise<void> {
  await apiClient.delete(`/api/accessories/${accessoryId}`);
}
