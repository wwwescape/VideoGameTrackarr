import { apiClient } from "./client";
import { buildGameFilterParams, type GameListFilters } from "./games";
import type {
  DuplicateLibraryItemGroup,
  InsightAccessoryRef,
  MissingAddonsEntry,
  OnSaleItem,
} from "./types";

export async function listDuplicateLibraryItems(): Promise<DuplicateLibraryItemGroup[]> {
  const response = await apiClient.get<DuplicateLibraryItemGroup[]>(
    "/api/insights/duplicate-library-items"
  );
  return response.data;
}

export async function listMissingAddons(
  filters: GameListFilters = {},
  signal?: AbortSignal
): Promise<MissingAddonsEntry[]> {
  const response = await apiClient.get<MissingAddonsEntry[]>("/api/insights/missing-addons", {
    params: buildGameFilterParams(filters),
    paramsSerializer: { indexes: null },
    signal,
  });
  return response.data;
}

export async function listAccessoriesWithoutOwnedHardware(): Promise<InsightAccessoryRef[]> {
  const response = await apiClient.get<InsightAccessoryRef[]>(
    "/api/insights/accessories-without-owned-hardware"
  );
  return response.data;
}

export async function listOnSale(): Promise<OnSaleItem[]> {
  const response = await apiClient.get<OnSaleItem[]>("/api/insights/on-sale");
  return response.data;
}
