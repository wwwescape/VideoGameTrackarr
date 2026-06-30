import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDeviceNote, deleteDeviceNote, listDeviceNotes, updateDeviceNote } from "../api/deviceNotes";

export function useDeviceNotes(deviceId: number) {
  return useQuery({
    queryKey: ["devices", deviceId, "notes"],
    queryFn: () => listDeviceNotes(deviceId),
    enabled: Number.isFinite(deviceId),
  });
}

function useInvalidateDeviceNotes(deviceId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "notes"] });
}

export function useCreateDeviceNote(deviceId: number) {
  const invalidate = useInvalidateDeviceNotes(deviceId);
  return useMutation({
    mutationFn: (body: string) => createDeviceNote(deviceId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateDeviceNote(deviceId: number) {
  const invalidate = useInvalidateDeviceNotes(deviceId);
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: number; body: string }) => updateDeviceNote(noteId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteDeviceNote(deviceId: number) {
  const invalidate = useInvalidateDeviceNotes(deviceId);
  return useMutation({
    mutationFn: (noteId: number) => deleteDeviceNote(noteId),
    onSuccess: invalidate,
  });
}
