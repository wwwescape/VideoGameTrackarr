import { apiClient } from "./client";
import type { NamedLookup } from "./types";

export async function listManufacturers(): Promise<NamedLookup[]> {
  const response = await apiClient.get<NamedLookup[]>("/api/manufacturers");
  return response.data;
}

export async function listHardwarePlatforms(): Promise<NamedLookup[]> {
  const response = await apiClient.get<NamedLookup[]>("/api/hardware-platforms");
  return response.data;
}

export async function listDeviceTypes(): Promise<NamedLookup[]> {
  const response = await apiClient.get<NamedLookup[]>("/api/device-types");
  return response.data;
}

export async function listAccessoryTypes(): Promise<NamedLookup[]> {
  const response = await apiClient.get<NamedLookup[]>("/api/accessory-types");
  return response.data;
}

export async function listStorageVariants(): Promise<NamedLookup[]> {
  const response = await apiClient.get<NamedLookup[]>("/api/storage-variants");
  return response.data;
}

export async function listColors(): Promise<NamedLookup[]> {
  const response = await apiClient.get<NamedLookup[]>("/api/colors");
  return response.data;
}
