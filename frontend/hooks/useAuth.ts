import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser, isAuthenticated, login, logout } from "../api/auth";

export const currentUserQueryKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    enabled: isAuthenticated(),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      login(username, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
