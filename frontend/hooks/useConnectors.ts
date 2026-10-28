import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveConnectorPairing,
  createConnector,
  deleteConnector,
  getConnectorPairing,
  listConnectors,
  revokeConnectorDevice,
  updateConnector,
} from "../api/connectors";
import type { ConnectorInput } from "../api/types";

export const connectorsQueryKey = ["connectors"] as const;

export function useConnectors() {
  return useQuery({ queryKey: connectorsQueryKey, queryFn: listConnectors });
}

// Every change refetches the list: a sync, a device or a pairing all show up there.
function useConnectorMutation<T>(mutationFn: (variables: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectorsQueryKey }),
  });
}

export const useCreateConnector = () => useConnectorMutation((input: ConnectorInput) => createConnector(input));

export const useUpdateConnector = () =>
  useConnectorMutation(({ id, input }: { id: number; input: ConnectorInput }) => updateConnector(id, input));

export const useDeleteConnector = () => useConnectorMutation((id: number) => deleteConnector(id));

export const useRevokeConnectorDevice = () =>
  useConnectorMutation(({ connectorId, deviceId }: { connectorId: number; deviceId: number }) =>
    revokeConnectorDevice(connectorId, deviceId)
  );

export function useConnectorPairing(code: string) {
  return useQuery({
    queryKey: ["connectors", "pairing", code],
    queryFn: () => getConnectorPairing(code),
    enabled: code.length > 0,
    retry: false,
  });
}

export const useApproveConnectorPairing = () => useConnectorMutation((code: string) => approveConnectorPairing(code));
