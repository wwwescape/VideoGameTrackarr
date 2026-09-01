import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIgnoredSalesTitles,
  retryIgnoredSalesTitle,
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
