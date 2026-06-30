import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNote, deleteNote, listNotes, updateNote } from "../api/notes";

export function useNotes(gameId: number) {
  return useQuery({
    queryKey: ["games", gameId, "notes"],
    queryFn: () => listNotes(gameId),
    enabled: Number.isFinite(gameId),
  });
}

function useInvalidateNotes(gameId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "notes"] });
}

export function useCreateNote(gameId: number) {
  const invalidate = useInvalidateNotes(gameId);
  return useMutation({
    mutationFn: (body: string) => createNote(gameId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateNote(gameId: number) {
  const invalidate = useInvalidateNotes(gameId);
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: number; body: string }) => updateNote(noteId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteNote(gameId: number) {
  const invalidate = useInvalidateNotes(gameId);
  return useMutation({
    mutationFn: (noteId: number) => deleteNote(noteId),
    onSuccess: invalidate,
  });
}
