import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runDangerZoneAction, type DangerZoneAction } from "../api/dangerZone";

export function useDangerZoneAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, confirmation }: { action: DangerZoneAction; confirmation?: string }) =>
      runDangerZoneAction(action, confirmation),
    // Removed data shows up everywhere (lists, Overview, Insights...): refetch it all.
    networkMode: "always",
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
