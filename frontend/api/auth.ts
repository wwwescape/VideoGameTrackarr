import axios from "axios";
import { API_BASE_URL, apiClient } from "./client";
import { tokenStorage } from "./tokenStorage";
import type {
  AuthTokens,
  CurrentUser,
  GameFilterFieldSetting,
  OverviewSectionSetting,
  SavedGameFilter,
  SetupStatus,
} from "./types";

// Login/logout/setup intentionally use plain axios, not apiClient: there's no access token
// yet at this point, and the interceptors' refresh-on-401 logic doesn't apply to any of them.

export async function login(username: string, password: string): Promise<void> {
  const response = await axios.post<AuthTokens>(`${API_BASE_URL}/api/auth/login`, {
    username,
    password,
  });
  tokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  const response = await axios.get<SetupStatus>(`${API_BASE_URL}/api/auth/setup-status`);
  return response.data;
}

export async function setupAdmin(username: string, password: string, setupCode: string): Promise<void> {
  const response = await axios.post<AuthTokens>(`${API_BASE_URL}/api/auth/setup`, {
    username,
    password,
    setupCode,
  });
  tokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();
  tokenStorage.clear();
  if (refreshToken) {
    await axios.post(`${API_BASE_URL}/api/auth/logout`, { refreshToken }).catch(() => {
      // Best-effort — tokens are already cleared client-side either way.
    });
  }
}

// Other sessions are signed out; this one gets fresh tokens and stays signed in.
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await apiClient.post<AuthTokens>("/api/auth/change-password", {
    currentPassword,
    newPassword,
  });
  tokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
}

// Only the fields given are changed.
export async function updatePreferences(preferences: {
  currency?: string;
  overviewLayout?: OverviewSectionSetting[];
  gameFilterFields?: GameFilterFieldSetting[];
  savedGameFilters?: SavedGameFilter[];
}): Promise<CurrentUser> {
  const response = await apiClient.put<CurrentUser>("/api/auth/me/preferences", preferences);
  return response.data;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await apiClient.get<CurrentUser>("/api/auth/me");
  return response.data;
}

export function isAuthenticated(): boolean {
  return Boolean(tokenStorage.getAccessToken());
}
