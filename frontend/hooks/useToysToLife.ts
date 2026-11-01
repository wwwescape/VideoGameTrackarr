import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attachTagToToy,
  createToysToLifeCopy,
  createToysToLifeNote,
  deleteToysToLifeCopy,
  deleteToysToLifeNote,
  detachTagFromToy,
  getToysToLifeGameSection,
  getToysToLifeItem,
  listToysToLifeItems,
  listToysToLifeLines,
  listToysToLifeNotes,
  setToysToLifeRating,
  type ToysToLifeCopyInput,
  updateToysToLifeCopy,
  updateToysToLifeNote,
} from "../api/toysToLife";
import type { DetailQueryOptions } from "./detailQueryOptions";

// Everything Toys-to-Life lives under one key: a pack's status or rating shows on its page,
// its line's grid and the line counts, so a change refreshes them all.
const TOYS_TO_LIFE = "toysToLife";

export function useToysToLifeLines() {
  return useQuery({ queryKey: [TOYS_TO_LIFE, "lines"], queryFn: listToysToLifeLines });
}

export function useToysToLifeItems(line: string | undefined) {
  return useQuery({
    queryKey: [TOYS_TO_LIFE, "items", line],
    queryFn: () => listToysToLifeItems(line!),
    enabled: Boolean(line),
  });
}

export function useToysToLifeItem(line: string | undefined, setNumber: string | undefined, options?: DetailQueryOptions) {
  return useQuery({
    queryKey: [TOYS_TO_LIFE, "item", line, setNumber],
    queryFn: () => getToysToLifeItem(line!, setNumber!),
    enabled: Boolean(line && setNumber),
    ...options,
  });
}

// Keyed under the game's library: which starter kits it shows follows the platforms you own
// the game on, so adding or removing a copy (which refreshes ["library", gameId]) refreshes it.
export function useToysToLifeGameSection(gameId: number) {
  return useQuery({
    queryKey: ["library", gameId, TOYS_TO_LIFE],
    queryFn: () => getToysToLifeGameSection(gameId),
    enabled: Number.isFinite(gameId),
  });
}

function useInvalidateToysToLife() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [TOYS_TO_LIFE] }),
      // The game page's sections (see useToysToLifeGameSection) show each pack's status too.
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "library" && query.queryKey[2] === TOYS_TO_LIFE }),
    ]);
}

// A copy changes the pack's status everywhere it shows, so these refresh it all.
export function useCreateToysToLifeCopy(itemId: number) {
  const invalidate = useInvalidateToysToLife();
  return useMutation({ mutationFn: (input: ToysToLifeCopyInput) => createToysToLifeCopy(itemId, input), onSuccess: invalidate });
}

export function useUpdateToysToLifeCopy() {
  const invalidate = useInvalidateToysToLife();
  return useMutation({
    mutationFn: ({ copyId, input }: { copyId: number; input: Partial<ToysToLifeCopyInput> }) => updateToysToLifeCopy(copyId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteToysToLifeCopy() {
  const invalidate = useInvalidateToysToLife();
  return useMutation({ mutationFn: (copyId: number) => deleteToysToLifeCopy(copyId), onSuccess: invalidate });
}

export function useSetToysToLifeRating(itemId: number) {
  const invalidate = useInvalidateToysToLife();
  return useMutation({
    mutationFn: (rating: number | null) => setToysToLifeRating(itemId, rating),
    onSuccess: invalidate,
  });
}

export function useToysToLifeNotes(itemId: number) {
  return useQuery({
    queryKey: [TOYS_TO_LIFE, itemId, "notes"],
    queryFn: () => listToysToLifeNotes(itemId),
    enabled: Number.isFinite(itemId),
  });
}

function useInvalidateToysToLifeNotes(itemId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [TOYS_TO_LIFE, itemId, "notes"] });
}

export function useCreateToysToLifeNote(itemId: number) {
  const invalidate = useInvalidateToysToLifeNotes(itemId);
  return useMutation({ mutationFn: (body: string) => createToysToLifeNote(itemId, body), onSuccess: invalidate });
}

export function useUpdateToysToLifeNote(itemId: number) {
  const invalidate = useInvalidateToysToLifeNotes(itemId);
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: number; body: string }) => updateToysToLifeNote(noteId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteToysToLifeNote(itemId: number) {
  const invalidate = useInvalidateToysToLifeNotes(itemId);
  return useMutation({ mutationFn: (noteId: number) => deleteToysToLifeNote(noteId), onSuccess: invalidate });
}

// The tags show on the pack's own page, so these refresh it.
export function useAttachToyTag(itemId: number) {
  const invalidate = useInvalidateToysToLife();
  return useMutation({ mutationFn: (tagId: number) => attachTagToToy(itemId, tagId), onSuccess: invalidate });
}

export function useDetachToyTag(itemId: number) {
  const invalidate = useInvalidateToysToLife();
  return useMutation({ mutationFn: (tagId: number) => detachTagFromToy(itemId, tagId), onSuccess: invalidate });
}
