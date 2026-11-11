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

// IGDB serves every size of an image from the same id, picked by the size segment in its
// address (…/image/upload/t_720p/co1abc.jpg). Covers are stored at t_720p (540×720), which
// game cards and detail pages show as is: a smaller card size saves almost nothing, and
// sharing one size keeps a cover cached once. Rows, avatars and cover grids show covers far
// smaller, so they ask IGDB for a smaller size. The cover sizes keep the whole image (no
// crop), like t_720p. Anything else (an uploaded /uploads/ image, another site's image) goes
// through resolveAssetUrl unchanged.
export type IgdbImageSize =
  // 90×128 (~4 KB against t_720p's ~80 KB): tiny row thumbnails, avatars and search results.
  | "t_cover_small"
  // 264×374 (~22 KB): small rows, Compare, and the Series/Collections cover grids.
  | "t_cover_big"
  // 889×500, cropped to 16:9 like the event cards that use it (event logos are t_1080p).
  | "t_screenshot_big"
  // Fits 1920×1080 uncropped (a cover comes back about 810×1080): the Screensaver's full-screen
  // covers, sharp on a tablet or TV.
  | "t_1080p";

const IGDB_SIZED_URL = /^(https?:\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+\//i;

export function resolveImageUrl(url: string | null, size: IgdbImageSize): string | null {
  if (url && IGDB_SIZED_URL.test(url)) {
    return url.replace(IGDB_SIZED_URL, `$1${size}/`);
  }
  return resolveAssetUrl(url);
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
