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
  listTags,
} from "../api/tags";

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: listTags });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string | null }) => createTag(name, color),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId] }),
  });
}

export function useDetachTag(gameId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => detachTag(gameId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId] }),
  });
}

export function useAttachDeviceTag(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => attachTagToDevice(deviceId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId] }),
  });
}

export function useDetachDeviceTag(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => detachTagFromDevice(deviceId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId] }),
  });
}

export function useAttachAccessoryTag(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => attachTagToAccessory(accessoryId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accessories", accessoryId] }),
  });
}

export function useDetachAccessoryTag(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => detachTagFromAccessory(accessoryId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accessories", accessoryId] }),
  });
}
