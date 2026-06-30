import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDevice, deleteDevice, getDevice, listDevices, updateDevice, type DeviceListParams } from "../api/device";
import type { DeviceInput } from "../api/types";

export function useDeviceList(params: DeviceListParams = {}) {
  return useQuery({
    queryKey: ["devices", params],
    queryFn: () => listDevices(params),
  });
}

export function useDeviceItem(identifier: string | undefined) {
  return useQuery({
    queryKey: ["devices", identifier],
    queryFn: () => getDevice(identifier!),
    enabled: !!identifier,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useUpdateDevice(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<DeviceInput>) => updateDevice(deviceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
