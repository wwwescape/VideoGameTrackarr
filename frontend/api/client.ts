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

// The session is really over (no refresh token, or the server refused it): sign in again.
class SessionExpiredError extends Error {}

// These answer 401 for bad credentials or a dead refresh token, so they never refresh. They're
// called with plain axios today; this keeps a 401 from them from ever looping.
const TOKEN_ENDPOINTS = ["/api/auth/login", "/api/auth/refresh", "/api/auth/setup", "/api/auth/logout"];

// Web Locks name: one refresh at a time across every tab and the installed app.
const REFRESH_LOCK = "vgt-token-refresh";

function redirectToLogin(): void {
  tokenStorage.clear();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function bearerTokenOf(config: InternalAxiosRequestConfig): string | null {
  const header = config.headers.get("Authorization");
  return typeof header === "string" ? header.replace(/^Bearer /, "") : null;
}

// Swaps the refresh token for a new pair and returns the new access token. Refresh tokens are
// single-use (each refresh replaces it), so two tabs refreshing with the same one would sign
// you out: the Web Lock makes them take turns, and a tab that waited finds the new token
// already stored. Only a 401 from the server ends the session; a network error or a 5xx (the
// server restarting for an upgrade, a dropped connection) leaves you signed in, and the next
// request tries again.
async function refreshAccessToken(staleAccessToken: string | null): Promise<string> {
  const refresh = async (): Promise<string> => {
    const current = tokenStorage.getAccessToken();
    if (current && current !== staleAccessToken) {
      return current;
    }
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new SessionExpiredError();
    }
    try {
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken }
      );
      tokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
      return response.data.accessToken;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Without Web Locks another tab may have just spent it; use what that tab stored.
        const latest = tokenStorage.getAccessToken();
        if (latest && tokenStorage.getRefreshToken() !== refreshToken) {
          return latest;
        }
        throw new SessionExpiredError();
      }
      throw error;
    }
  };
  return "locks" in navigator ? navigator.locks.request(REFRESH_LOCK, refresh) : refresh();
}

// Every request that 401s while a refresh is under way waits for that same refresh.
let refreshInFlight: Promise<string> | null = null;

function sharedRefresh(staleAccessToken: string | null): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(staleAccessToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      TOKEN_ENDPOINTS.some((endpoint) => originalRequest.url?.startsWith(endpoint))
    ) {
      return Promise.reject(error);
    }

    // An expired access token, from any endpoint (/api/auth/me included): refresh and retry once.
    originalRequest._retry = true;
    try {
      const accessToken = await sharedRefresh(bearerTokenOf(originalRequest));
      originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
      return await apiClient.request(originalRequest);
    } catch (retryError) {
      if (retryError instanceof SessionExpiredError) {
        redirectToLogin();
        return Promise.reject(error);
      }
      return Promise.reject(retryError);
    }
  }
);
