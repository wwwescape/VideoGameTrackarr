import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getShareLink, regenerateShareLink } from "../api/share";

export function useShareLink() {
  return useQuery({ queryKey: ["share-link"], queryFn: getShareLink });
}

export function useRegenerateShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: regenerateShareLink,
    onSuccess: (token) => queryClient.setQueryData(["share-link"], token),
  });
}
