import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIgnoredSalesTitles,
  getTrackedSalesItems,
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
