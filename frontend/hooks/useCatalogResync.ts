import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeCatalogResyncStatus,
  fetchCatalogResyncStatus,
  startCollectionResync,
  startFranchiseResync,
} from "../api/catalogResync";

export const catalogResyncStatusQueryKey = ["catalog-resync", "status"] as const;

// Polled continuously (like useRestoreStatus) so CatalogResyncButton picks up an
// already-running job on mount — e.g. the user started a resync, navigated away, and came
// back to the same Collection/Series page.
export function useCatalogResyncStatus() {
  return useQuery({
    queryKey: catalogResyncStatusQueryKey,
    queryFn: fetchCatalogResyncStatus,
    refetchInterval: 3000,
    staleTime: 0,
    refetchIntervalInBackground: true,
  });
}

export function useStartCollectionResync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startCollectionResync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogResyncStatusQueryKey });
    },
  });
}

export function useStartFranchiseResync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startFranchiseResync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogResyncStatusQueryKey });
    },
  });
}

export function useAcknowledgeCatalogResyncStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeCatalogResyncStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogResyncStatusQueryKey });
    },
  });
}
