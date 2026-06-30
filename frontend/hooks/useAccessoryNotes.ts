import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAccessoryNote,
  deleteAccessoryNote,
  listAccessoryNotes,
  updateAccessoryNote,
} from "../api/accessoryNotes";

export function useAccessoryNotes(accessoryId: number) {
  return useQuery({
    queryKey: ["accessories", accessoryId, "notes"],
    queryFn: () => listAccessoryNotes(accessoryId),
    enabled: Number.isFinite(accessoryId),
  });
}

function useInvalidateAccessoryNotes(accessoryId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["accessories", accessoryId, "notes"] });
}

export function useCreateAccessoryNote(accessoryId: number) {
  const invalidate = useInvalidateAccessoryNotes(accessoryId);
  return useMutation({
    mutationFn: (body: string) => createAccessoryNote(accessoryId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateAccessoryNote(accessoryId: number) {
  const invalidate = useInvalidateAccessoryNotes(accessoryId);
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: number; body: string }) => updateAccessoryNote(noteId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteAccessoryNote(accessoryId: number) {
  const invalidate = useInvalidateAccessoryNotes(accessoryId);
  return useMutation({
    mutationFn: (noteId: number) => deleteAccessoryNote(noteId),
    onSuccess: invalidate,
  });
}
