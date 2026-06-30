import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addUserDevice, deleteUserDevice, listUserDevices, updateUserDevice } from "../api/userDevice";
import type { LibraryStatus, UserDeviceInput } from "../api/types";

function invalidateDevice(queryClient: ReturnType<typeof useQueryClient>, deviceId: number) {
  queryClient.invalidateQueries({ queryKey: ["devices", deviceId] });
  queryClient.invalidateQueries({ queryKey: ["hardware-stats"] });
  queryClient.invalidateQueries({ queryKey: ["devices"] });
}

export function useUserDeviceList(deviceId: number, status?: LibraryStatus) {
  return useQuery({
    queryKey: ["devices", deviceId, "user-devices", status ?? "all"],
    queryFn: () => listUserDevices(deviceId, status),
    enabled: Number.isFinite(deviceId),
  });
}

export function useAddUserDevice(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserDeviceInput) => addUserDevice(deviceId, input),
    onSuccess: () => invalidateDevice(queryClient, deviceId),
  });
}

export function useUpdateUserDevice(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: number; input: Partial<UserDeviceInput> }) =>
      updateUserDevice(itemId, input),
    onSuccess: () => invalidateDevice(queryClient, deviceId),
  });
}

export function useDeleteUserDevice(deviceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUserDevice,
    onSuccess: () => invalidateDevice(queryClient, deviceId),
  });
}
