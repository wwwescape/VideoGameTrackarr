import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addLibraryItem,
  addRom,
  deleteBios,
  deleteLibraryItem,
  deleteRom,
  deleteSaveState,
  getEmulationConfig,
  listBiosSystems,
  listSaveStates,
  listLibraryItems,
  replaceRom,
  updateLibraryItem,
  updateRomLabel,
  uploadBios,
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

type ProgressFn = (fraction: number) => void;

function useInvalidateLibrary(gameId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["library", gameId] });
}

export function useAddRom(gameId: number) {
  const invalidate = useInvalidateLibrary(gameId);
  return useMutation({
    mutationFn: (args: { itemId: number; file: File; label: string | null; onProgress?: ProgressFn }) =>
      addRom(args.itemId, args.file, args.label, args.onProgress),
    onSuccess: invalidate,
  });
}

export function useReplaceRom(gameId: number) {
  const invalidate = useInvalidateLibrary(gameId);
  return useMutation({
    mutationFn: (args: { romId: number; file: File; onProgress?: ProgressFn }) =>
      replaceRom(args.romId, args.file, args.onProgress),
    onSuccess: invalidate,
  });
}

export function useUpdateRomLabel(gameId: number) {
  const invalidate = useInvalidateLibrary(gameId);
  return useMutation({
    mutationFn: ({ romId, label }: { romId: number; label: string | null }) => updateRomLabel(romId, label),
    onSuccess: invalidate,
  });
}

export function useDeleteRom(gameId: number) {
  const invalidate = useInvalidateLibrary(gameId);
  return useMutation({
    mutationFn: (romId: number) => deleteRom(romId),
    onSuccess: invalidate,
  });
}

// --- BIOS files (Settings → Emulation) ---

export function useBiosSystems() {
  return useQuery({ queryKey: ["bios"], queryFn: listBiosSystems });
}

function useInvalidateBios() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["bios"] });
    // Whether a ROM is playable depends on its system's BIOS being uploaded.
    queryClient.invalidateQueries({ queryKey: ["library"] });
  };
}

export function useUploadBios() {
  const invalidate = useInvalidateBios();
  return useMutation({
    mutationFn: ({ system, file }: { system: string; file: File }) => uploadBios(system, file),
    onSuccess: invalidate,
  });
}

export function useDeleteBios() {
  const invalidate = useInvalidateBios();
  return useMutation({
    mutationFn: (biosId: number) => deleteBios(biosId),
    onSuccess: invalidate,
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
