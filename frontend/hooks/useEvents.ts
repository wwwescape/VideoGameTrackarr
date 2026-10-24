import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DetailQueryOptions } from "./detailQueryOptions";
import { getEvent, listUpcomingEvents, resyncEvent } from "../api/events";

export function useEvents() {
  return useQuery({ queryKey: ["events"], queryFn: listUpcomingEvents });
}

export function useEvent(identifier: string | undefined, options?: DetailQueryOptions) {
  return useQuery({
    queryKey: ["events", identifier],
    queryFn: () => getEvent(identifier!),
    enabled: !!identifier,
    ...options,
  });
}

export function useResyncEvent(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resyncEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
