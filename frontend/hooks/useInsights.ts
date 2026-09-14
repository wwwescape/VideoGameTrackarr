import { useQuery } from "@tanstack/react-query";
import {
  listAccessoriesWithoutOwnedHardware,
  listDuplicateLibraryItems,
  listMissingAddons,
  listOnSale,
} from "../api/insights";
import type { GameListFilters } from "../api/games";

export function useDuplicateLibraryItems() {
  return useQuery({
    queryKey: ["insights", "duplicate-library-items"],
    queryFn: listDuplicateLibraryItems,
  });
}

export function useMissingAddons(filters: GameListFilters = {}) {
  return useQuery({
    queryKey: ["insights", "missing-addons", filters],
    queryFn: ({ signal }) => listMissingAddons(filters, signal),
  });
}

export function useAccessoriesWithoutOwnedHardware() {
  return useQuery({
    queryKey: ["insights", "accessories-without-owned-hardware"],
    queryFn: listAccessoriesWithoutOwnedHardware,
  });
}

export function useOnSale() {
  return useQuery({ queryKey: ["insights", "on-sale"], queryFn: listOnSale });
}
