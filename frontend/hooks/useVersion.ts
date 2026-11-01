import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getVersion, getWhatsNew, markWhatsNewSeen } from "../api/version";

// Changes at most once per release — no need for interval polling like the jobs list or
// restore status; a long staleTime just avoids refetching on every remount/focus.
//
// checkForUpdates() is for an on-demand caller (the About page's "Check for updates"
// button): plain refetch() would only bypass this hook's own staleTime, not the backend's
// separate 6-hour GitHub-response cache (version_service.py) — so a manual check could
// silently replay a stale answer. forceRef lets the next queryFn invocation ask for
// force=true (GET /api/version?force=true, which skips that server-side cache's read, not
// disables it) without changing this hook's queryKey/queryFn identity on every render.
export function useVersion() {
  const forceRef = useRef(false);
  const query = useQuery({
    queryKey: ["version"],
    queryFn: () => {
      const force = forceRef.current;
      forceRef.current = false;
      return getVersion(force);
    },
    staleTime: 60 * 60 * 1000,
  });

  const checkForUpdates = () => {
    forceRef.current = true;
    return query.refetch();
  };

  return { ...query, checkForUpdates };
}

// Asked once per app load: the answer only changes with an upgrade (which reloads the app)
// or when it's marked seen (which clears it below).
export function useWhatsNew() {
  return useQuery({ queryKey: ["whatsNew"], queryFn: getWhatsNew, staleTime: Infinity, retry: false });
}

export function useMarkWhatsNewSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markWhatsNewSeen,
    onSuccess: () =>
      queryClient.setQueryData(["whatsNew"], (current: Awaited<ReturnType<typeof getWhatsNew>> | undefined) =>
        current ? { ...current, releases: [], notesUnavailable: false } : current
      ),
  });
}
