import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DetailQueryOptions } from "./detailQueryOptions";
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

export function useAccessoryItem(identifier: string | undefined, options?: DetailQueryOptions) {
  return useQuery({
    queryKey: ["accessories", identifier],
    queryFn: () => getAccessory(identifier!),
    enabled: !!identifier,
    ...options,
  });
}

export function useCreateAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccessory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

export function useUpdateAccessory(accessoryId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AccessoryInput>) => updateAccessory(accessoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

export function useDeleteAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccessory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessories"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}
