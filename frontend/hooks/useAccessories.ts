import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAccessory,
  deleteAccessory,
  getAccessory,
  listAccessories,
  updateAccessory,
  type AccessoryListParams,
} from "../api/accessories";
import type { AccessoryInput } from "../api/types";

export function useAccessoryList(params: AccessoryListParams = {}) {
  return useQuery({
    queryKey: ["accessories", params],
    queryFn: () => listAccessories(params),
  });
}

export function useAccessoryItem(identifier: string | undefined) {
  return useQuery({
    queryKey: ["accessories", identifier],
    queryFn: () => getAccessory(identifier!),
    enabled: !!identifier,
  });
}

export function useCreateAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccessory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
    },
  });
}

export function useUpdateAccessory(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AccessoryInput>) => updateAccessory(accessoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
    },
  });
}

export function useDeleteAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccessory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
    },
  });
}
