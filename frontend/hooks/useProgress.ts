import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGameProgress, updateGameProgress } from "../api/progress";
import type { GameProgressUpdateInput } from "../api/types";

export function useGameProgress(gameId: number) {
  return useQuery({
    queryKey: ["games", gameId, "progress"],
    queryFn: () => getGameProgress(gameId),
    enabled: Number.isFinite(gameId),
  });
}

export function useUpdateGameProgress(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GameProgressUpdateInput) => updateGameProgress(gameId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId, "progress"] });
      queryClient.invalidateQueries({ queryKey: ["games", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
