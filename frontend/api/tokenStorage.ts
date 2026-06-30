const ACCESS_TOKEN_KEY = "vgt.accessToken";
const REFRESH_TOKEN_KEY = "vgt.refreshToken";

// localStorage, not an httpOnly cookie — the backend (M3) returns tokens in the JSON
// response body rather than setting cookies, so this is the matching client-side half.
// Reasonable for a self-hosted single-admin app; revisit if this ever becomes multi-tenant.
export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
