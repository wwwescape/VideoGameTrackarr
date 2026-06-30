import { apiClient } from "./client";
import type { DuplicateLibraryItemGroup, InsightAccessoryRef, MissingDlcEntry } from "./types";

export async function listDuplicateLibraryItems(): Promise<DuplicateLibraryItemGroup[]> {
  const response = await apiClient.get<DuplicateLibraryItemGroup[]>("/api/insights/duplicate-library-items");
  return response.data;
}

export async function listMissingDlc(): Promise<MissingDlcEntry[]> {
  const response = await apiClient.get<MissingDlcEntry[]>("/api/insights/missing-dlc");
  return response.data;
}

export async function listAccessoriesWithoutOwnedHardware(): Promise<InsightAccessoryRef[]> {
  const response = await apiClient.get<InsightAccessoryRef[]>("/api/insights/accessories-without-owned-hardware");
  return response.data;
}
