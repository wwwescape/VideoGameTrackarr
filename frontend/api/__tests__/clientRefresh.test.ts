import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../client";
import { tokenStorage } from "../tokenStorage";

const assign = vi.fn();

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

// Answers 401 until a request carries the fresh access token.
function serveWithToken(validToken: string) {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const auth = AxiosHeaders.from(config.headers).get("Authorization");
    if (auth === `Bearer ${validToken}`) {
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    }
    const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config };
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, response);
  };
}

function refreshFails(status: number | null) {
  return vi.spyOn(axios, "post").mockImplementation(async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    if (status === null) throw new AxiosError("Network Error", "ERR_NETWORK", config);
    throw new AxiosError("Failed", "ERR_BAD_REQUEST", config, null, {
      data: {},
      status,
      statusText: "",
      headers: {},
      config,
    });
  });
}

describe("apiClient token refresh", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("location", { pathname: "/games", assign });
    tokenStorage.setTokens("stale-access", "refresh-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    assign.mockReset();
  });

  it("refreshes an expired access token for /api/auth/me instead of signing out", async () => {
    serveWithToken("fresh-access");
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { accessToken: "fresh-access", refreshToken: "refresh-2" } });

    const response = await apiClient.get("/api/auth/me");

    expect(response.data).toEqual({ ok: true });
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
    expect(assign).not.toHaveBeenCalled();
  });

  it("shares one refresh between requests that expire together", async () => {
    serveWithToken("fresh-access");
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { accessToken: "fresh-access", refreshToken: "refresh-2" } });

    await Promise.all([apiClient.get("/api/games"), apiClient.get("/api/devices"), apiClient.get("/api/auth/me")]);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("keeps you signed in when the refresh can't reach the server (an upgrade restarting it)", async () => {
    serveWithToken("fresh-access");
    refreshFails(null);

    await expect(apiClient.get("/api/games")).rejects.toBeInstanceOf(AxiosError);

    expect(tokenStorage.getRefreshToken()).toBe("refresh-1");
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps you signed in when the server errors during the refresh", async () => {
    serveWithToken("fresh-access");
    refreshFails(502);

    await expect(apiClient.get("/api/games")).rejects.toBeInstanceOf(AxiosError);

    expect(tokenStorage.getRefreshToken()).toBe("refresh-1");
    expect(assign).not.toHaveBeenCalled();
  });

  it("signs out when the server refuses the refresh token", async () => {
    serveWithToken("fresh-access");
    refreshFails(401);

    await expect(apiClient.get("/api/games")).rejects.toBeInstanceOf(AxiosError);

    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("uses the tokens another tab just stored instead of signing out", async () => {
    serveWithToken("other-tab-access");
    vi.spyOn(axios, "post").mockImplementation(async () => {
      // Another tab rotated refresh-1 first and saved its new pair.
      tokenStorage.setTokens("other-tab-access", "refresh-other");
      const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
      throw new AxiosError("Revoked", "ERR_BAD_REQUEST", config, null, {
        data: {},
        status: 401,
        statusText: "",
        headers: {},
        config,
      });
    });

    const response = await apiClient.get("/api/games");

    expect(response.data).toEqual({ ok: true });
    expect(assign).not.toHaveBeenCalled();
  });
});
