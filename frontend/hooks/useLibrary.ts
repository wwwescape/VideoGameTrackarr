import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addLibraryItem, deleteLibraryItem, listLibraryItems, updateLibraryItem } from "../api/library";
import type { LibraryItemInput } from "../api/types";

export function useLibraryItems(gameId: number) {
  return useQuery({
    queryKey: ["library", gameId],
    queryFn: () => listLibraryItems(gameId),
    enabled: Number.isFinite(gameId),
  });
}

export function useAddLibraryItem(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LibraryItemInput) => addLibraryItem(gameId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useUpdateLibraryItem(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: number; input: Partial<LibraryItemInput> }) =>
      updateLibraryItem(itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}

export function useDeleteLibraryItem(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => deleteLibraryItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", gameId] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
}
