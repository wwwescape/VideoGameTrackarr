import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disableShareLink, enableShareLink, getShareLink, regenerateShareLink } from "../api/share";

export function useShareLink() {
  return useQuery({ queryKey: ["share-link"], queryFn: getShareLink });
}

export function useEnableShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enableShareLink,
    onSuccess: (token) => queryClient.setQueryData(["share-link"], token),
  });
}

export function useDisableShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disableShareLink,
    onSuccess: () => queryClient.setQueryData(["share-link"], null),
  });
}

export function useRegenerateShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: regenerateShareLink,
    onSuccess: (token) => queryClient.setQueryData(["share-link"], token),
  });
}
