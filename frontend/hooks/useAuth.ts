import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  fetchCurrentUser,
  fetchSetupStatus,
  isAuthenticated,
  login,
  logout,
  setupAdmin,
} from "../api/auth";

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

// Runs unauthenticated (no `enabled` gate) — this is what /login itself uses to decide
// between showing the sign-in form and the first-run create-admin form.
export function useSetupStatus() {
  return useQuery({
    queryKey: ["auth", "setup-status"],
    queryFn: fetchSetupStatus,
    retry: false,
  });
}

export function useSetupAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password, setupCode }: { username: string; password: string; setupCode: string }) =>
      setupAdmin(username, password, setupCode),
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

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
  });
}
