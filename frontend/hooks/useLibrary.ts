import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addLibraryItem,
  deleteLibraryItem,
  deleteRom,
  deleteSaveState,
  getEmulationConfig,
  listSaveStates,
  listLibraryItems,
  updateLibraryItem,
  uploadRom,
} from "../api/library";
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
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUploadRom(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, file, onProgress }: { itemId: number; file: File; onProgress?: (fraction: number) => void }) =>
      uploadRom(itemId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", gameId] });
    },
  });
}

export function useDeleteRom(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => deleteRom(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", gameId] });
    },
  });
}

export function useEmulationConfig() {
  return useQuery({
    queryKey: ["emulation"],
    queryFn: getEmulationConfig,
    staleTime: Infinity,
  });
}

export function useSaveStates(romId: number | null) {
  return useQuery({
    queryKey: ["romStates", romId],
    queryFn: () => listSaveStates(romId as number),
    enabled: romId != null,
  });
}

// Save state / in-game save changes alter a copy's saveStateCount/hasInGameSave — the
// player doesn't know the game id, so refresh every cached library list.
export function useInvalidateRomSaves() {
  const queryClient = useQueryClient();
  return (romId: number) => {
    queryClient.invalidateQueries({ queryKey: ["romStates", romId] });
    queryClient.invalidateQueries({ queryKey: ["library"] });
  };
}

export function useDeleteSaveState(romId: number) {
  const invalidate = useInvalidateRomSaves();
  return useMutation({
    mutationFn: (stateId: number) => deleteSaveState(romId, stateId),
    onSuccess: () => invalidate(romId),
  });
}
