import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attachTag,
  attachTagToAccessory,
  attachTagToDevice,
  createTag,
  deleteTag,
  detachTag,
  detachTagFromAccessory,
  detachTagFromDevice,
  getTagCoverage,
  listTags,
  updateTag,
} from "../api/tags";

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: listTags });
}

// Only fetched while the bulk "Manage Tags" dialog is actually open (via `enabled`) — this
// data is meaningless outside that one dialog, so there's no reason to keep it warm/cached
// the rest of the time the Games page is open.
export function useTagCoverage(gameIds: number[], enabled: boolean) {
  return useQuery({
    queryKey: ["tagCoverage", gameIds],
    queryFn: () => getTagCoverage(gameIds),
    enabled: enabled && gameIds.length > 0,
  });
}

// Backs both the Add and Remove tabs of the bulk "Manage Tags" dialog — one fans out
// attach calls, the other detach calls, but it's the same "N games × M tags" shape either
// way, so one mutation covers both rather than two near-identical ones. Fans out one
// request per (game, tag) pair client-side (same chatty-but-simple pattern GameList.tsx's
// existing bulk-delete already uses) rather than a dedicated batch endpoint.
export function useBulkUpdateGameTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gameIds,
      addTagIds = [],
      removeTagIds = [],
    }: {
      gameIds: number[];
      addTagIds?: number[];
      removeTagIds?: number[];
    }) => {
      await Promise.all([
        ...gameIds.flatMap((gameId) => addTagIds.map((tagId) => attachTag(gameId, tagId))),
        ...gameIds.flatMap((gameId) => removeTagIds.map((tagId) => detachTag(gameId, tagId))),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["tagCoverage"] });
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color, textColor }: { name: string; color?: string | null; textColor?: string | null }) =>
      createTag(name, color, textColor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tagId,
      name,
      color,
      textColor,
    }: {
      tagId: number;
      name: string;
      color?: string | null;
      textColor?: string | null;
    }) => updateTag(tagId, name, color, textColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      // A rename changes the tag's name embedded in every game/device/accessory's cached
      // `tags` array — same broad-invalidation reasoning as useDeleteTag below.
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      // A deleted tag is detached from every game/device/accessory it was on — simplest
      // correct way to reflect that everywhere is to drop all cached detail data.
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
    },
  });
}

export function useAttachTag(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => attachTag(gameId, tagId),
    // Broad prefix, not ["games", gameId] — useGame() caches by the route's string
    // identifier (slug), not this numeric id, so a narrower key here would never match
    // the query actually backing the page and the new tag wouldn't show until a reload.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] }),
  });
}

export function useDetachTag(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => detachTag(gameId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] }),
  });
}

export function useAttachDeviceTag(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => attachTagToDevice(deviceId, tagId),
    // Same reasoning as useAttachTag — useDeviceItem() caches by the route's uuid, not
    // this numeric id.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

export function useDetachDeviceTag(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => detachTagFromDevice(deviceId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

export function useAttachAccessoryTag(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => attachTagToAccessory(accessoryId, tagId),
    // Same reasoning as useAttachTag — useAccessoryItem() caches by the route's uuid,
    // not this numeric id.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accessories"] }),
  });
}

export function useDetachAccessoryTag(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => detachTagFromAccessory(accessoryId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accessories"] }),
  });
}
