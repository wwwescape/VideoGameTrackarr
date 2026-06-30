import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "./tokenStorage";

const isDevelopmentServer =
  window.location.hostname === "localhost" && window.location.port === "3000";

// Dev: Vite serves the frontend on :3000, FastAPI runs separately on :8000. Prod: FastAPI
// serves the built frontend itself, so they're the same origin (see "Deploying with
// Docker" in the root README).
export const API_BASE_URL = isDevelopmentServer ? "http://localhost:8000" : window.location.origin;

export const apiClient = axios.create({ baseURL: API_BASE_URL });

// Locally-uploaded covers/images are stored as a relative `/uploads/...` path (see
// upload_service.py) — fine in prod where the frontend and API share an origin, but in dev
// the frontend runs on :3000 while the API (and its static /uploads mount) is on :8000, so a
// bare relative path 404s against the dev server. IGDB covers are already absolute https
// URLs and pass through unchanged.
export function resolveAssetUrl(url: string | null): string | null {
  if (!url || /^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface PendingRequest {
  config: RetryableConfig;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];

function redirectToLogin(): void {
  tokenStorage.clear();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // A 401 from the auth endpoints themselves means bad credentials or an already-dead
    // refresh token — refreshing again would just loop.
    if (originalRequest.url?.startsWith("/api/auth/")) {
      redirectToLogin();
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ config: originalRequest, resolve, reject });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken }
      );
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      tokenStorage.setTokens(accessToken, newRefreshToken);

      pendingRequests.forEach(({ config, resolve, reject }) => {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
        apiClient.request(config).then(resolve).catch(reject);
      });
      pendingRequests = [];

      originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
      return apiClient.request(originalRequest);
    } catch (refreshError) {
      pendingRequests.forEach(({ reject }) => reject(refreshError));
      pendingRequests = [];
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
