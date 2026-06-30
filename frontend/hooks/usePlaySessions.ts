import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPlaySession, deletePlaySession, listPlaySessions, updatePlaySession } from "../api/playSessions";
import type { PlaySessionInput } from "../api/types";

export function usePlaySessions(gameId: number) {
  return useQuery({
    queryKey: ["games", gameId, "play-sessions"],
    queryFn: () => listPlaySessions(gameId),
    enabled: Number.isFinite(gameId),
  });
}

function useInvalidatePlaySessions(gameId: number) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["games", gameId, "play-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["games", gameId, "progress"] });
  };
}

export function useCreatePlaySession(gameId: number) {
  const invalidate = useInvalidatePlaySessions(gameId);
  return useMutation({
    mutationFn: (input: PlaySessionInput) => createPlaySession(gameId, input),
    onSuccess: invalidate,
  });
}

export function useUpdatePlaySession(gameId: number) {
  const invalidate = useInvalidatePlaySessions(gameId);
  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: number; input: Partial<PlaySessionInput> }) =>
      updatePlaySession(sessionId, input),
    onSuccess: invalidate,
  });
}

export function useDeletePlaySession(gameId: number) {
  const invalidate = useInvalidatePlaySessions(gameId);
  return useMutation({
    mutationFn: (sessionId: number) => deletePlaySession(sessionId),
    onSuccess: invalidate,
  });
}
