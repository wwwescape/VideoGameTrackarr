import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIgnoredSalesTitles,
  getTrackedSalesItems,
  removeIgnoredSalesTitle,
  retryIgnoredSalesTitle,
  untrackSalesItem,
  type SalesProvider,
} from "../api/salesTracking";

export function useIgnoredSalesTitles() {
  return useQuery({ queryKey: ["sales-tracking-ignored"], queryFn: getIgnoredSalesTitles });
}

export function useRetryIgnoredSalesTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, gameId }: { provider: SalesProvider; gameId: number }) =>
      retryIgnoredSalesTitle(provider, gameId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales-tracking-ignored"] }),
  });
}

// Unlike retry above, this turns off track_for_sales on the game's wishlist rows (same
// underlying state the Sale - Tracked page's Untrack button flips), so it can also affect
// what that page shows — invalidated the same way useUntrackSalesItem does below.
export function useRemoveIgnoredSalesTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, gameId }: { provider: SalesProvider; gameId: number }) =>
      removeIgnoredSalesTitle(provider, gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-tracking-ignored"] });
      queryClient.invalidateQueries({ queryKey: ["sales-tracking-tracked"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useTrackedSalesItems() {
  return useQuery({ queryKey: ["sales-tracking-tracked"], queryFn: getTrackedSalesItems });
}

export function useUntrackSalesItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (libraryItemId: number) => untrackSalesItem(libraryItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-tracking-tracked"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
