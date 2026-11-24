import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGuideFile,
  createGuideLink,
  deleteGuide,
  getGuideUploadOptions,
  listGuides,
  replaceGuideFile,
  updateGuide,
  type GuideFileFields,
} from "../api/guides";
import type { GuideChanges } from "../api/types";

export function useGuides(gameId: number) {
  return useQuery({
    queryKey: ["games", gameId, "guides"],
    queryFn: () => listGuides(gameId),
    enabled: Number.isFinite(gameId),
  });
}

// The upload limit and accepted types only change with a server restart.
export function useGuideUploadOptions() {
  return useQuery({
    queryKey: ["guides", "upload-options"],
    queryFn: getGuideUploadOptions,
    staleTime: Infinity,
  });
}

function useInvalidateGuides(gameId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "guides"] });
}

interface UploadArgs {
  file: File;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export function useCreateGuideFile(gameId: number) {
  const invalidate = useInvalidateGuides(gameId);
  return useMutation({
    mutationFn: ({ file, fields, onProgress, signal }: UploadArgs & { fields: GuideFileFields }) =>
      createGuideFile(gameId, file, fields, onProgress, signal),
    // A File can't survive the offline persister's JSON serialization, so an upload runs (or
    // fails) now rather than being queued for when the network returns.
    networkMode: "always",
    onSuccess: invalidate,
  });
}

export function useCreateGuideLink(gameId: number) {
  const invalidate = useInvalidateGuides(gameId);
  return useMutation({
    mutationFn: ({ url, fields }: { url: string; fields: GuideFileFields }) =>
      createGuideLink(gameId, url, fields),
    onSuccess: invalidate,
  });
}

export function useUpdateGuide(gameId: number) {
  const invalidate = useInvalidateGuides(gameId);
  return useMutation({
    mutationFn: ({ guideId, changes }: { guideId: number; changes: GuideChanges }) =>
      updateGuide(guideId, changes),
    onSuccess: invalidate,
  });
}

export function useReplaceGuideFile(gameId: number) {
  const invalidate = useInvalidateGuides(gameId);
  return useMutation({
    mutationFn: ({ guideId, file, onProgress, signal }: UploadArgs & { guideId: number }) =>
      replaceGuideFile(guideId, file, onProgress, signal),
    networkMode: "always",
    onSuccess: invalidate,
  });
}

export function useDeleteGuide(gameId: number) {
  const invalidate = useInvalidateGuides(gameId);
  return useMutation({
    mutationFn: (guideId: number) => deleteGuide(guideId),
    onSuccess: invalidate,
  });
}
