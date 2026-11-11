import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listGameCases, setGameCaseShown } from "../api/gameCases";
import type { GameCase } from "../api/types";

const gameCasesQueryKey = ["game-cases"] as const;

export function useGameCases() {
  return useQuery({ queryKey: gameCasesQueryKey, queryFn: listGameCases });
}

// The switch flips at once; it's put back if saving fails. The shelf is refreshed either way.
export function useSetGameCaseShown() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, shown }: { id: number; shown: boolean }) => setGameCaseShown(id, shown),
    onMutate: async ({ id, shown }) => {
      await queryClient.cancelQueries({ queryKey: gameCasesQueryKey });
      const previous = queryClient.getQueryData<GameCase[]>(gameCasesQueryKey);
      queryClient.setQueryData<GameCase[]>(gameCasesQueryKey, (cases) =>
        cases?.map((gameCase) => (gameCase.id === id ? { ...gameCase, shown } : gameCase))
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(gameCasesQueryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: gameCasesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["games", "shelf"] });
      queryClient.invalidateQueries({ queryKey: ["public"] });
    },
  });
}
