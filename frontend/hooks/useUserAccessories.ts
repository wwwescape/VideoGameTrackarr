import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addUserAccessory,
  deleteUserAccessory,
  listUserAccessories,
  updateUserAccessory,
} from "../api/userAccessories";
import type { LibraryStatus, UserAccessoryInput } from "../api/types";

function invalidateAccessory(queryClient: ReturnType<typeof useQueryClient>, accessoryId: number) {
  queryClient.invalidateQueries({ queryKey: ["accessories", accessoryId] });
  queryClient.invalidateQueries({ queryKey: ["hardware-stats"] });
  queryClient.invalidateQueries({ queryKey: ["accessories"] });
}

export function useUserAccessoryList(accessoryId: number, status?: LibraryStatus) {
  return useQuery({
    queryKey: ["accessories", accessoryId, "user-accessories", status ?? "all"],
    queryFn: () => listUserAccessories(accessoryId, status),
    enabled: Number.isFinite(accessoryId),
  });
}

export function useAddUserAccessory(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserAccessoryInput) => addUserAccessory(accessoryId, input),
    onSuccess: () => invalidateAccessory(queryClient, accessoryId),
  });
}

export function useUpdateUserAccessory(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: number; input: Partial<UserAccessoryInput> }) =>
      updateUserAccessory(itemId, input),
    onSuccess: () => invalidateAccessory(queryClient, accessoryId),
  });
}

export function useDeleteUserAccessory(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUserAccessory,
    onSuccess: () => invalidateAccessory(queryClient, accessoryId),
  });
}
