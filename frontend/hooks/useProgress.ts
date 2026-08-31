import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGameProgress,
  deleteGameProgress,
  listGameProgress,
  updateGameProgress,
} from "../api/progress";
import type { GameProgressCreateInput, GameProgressUpdateInput } from "../api/types";

export function useGameProgressList(gameId: number) {
  return useQuery({
    queryKey: ["games", gameId, "progress"],
    queryFn: () => listGameProgress(gameId),
    enabled: Number.isFinite(gameId),
  });
}

function useInvalidateProgress(gameId: number) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["games", gameId, "progress"] });
    queryClient.invalidateQueries({ queryKey: ["games", gameId] });
    queryClient.invalidateQueries({ queryKey: ["games"] });
  };
}

export function useCreateGameProgress(gameId: number) {
  const invalidate = useInvalidateProgress(gameId);
  return useMutation({
    mutationFn: (input: GameProgressCreateInput) => createGameProgress(gameId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateGameProgress(gameId: number) {
  const invalidate = useInvalidateProgress(gameId);
  return useMutation({
    mutationFn: ({ progressId, input }: { progressId: number; input: GameProgressUpdateInput }) =>
      updateGameProgress(progressId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteGameProgress(gameId: number) {
  const invalidate = useInvalidateProgress(gameId);
  return useMutation({
    mutationFn: (progressId: number) => deleteGameProgress(progressId),
    onSuccess: invalidate,
  });
}
