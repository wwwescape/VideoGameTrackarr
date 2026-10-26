import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/query-persist-client-core";
import { createStore, del, get, set } from "idb-keyval";

const idbStore = createStore("videogametrackarr-offline", "query-cache");

// idb-keyval's get/set/del are already string-in-string-out here (the persister only ever
// stores its own serialized JSON string under one key), so this satisfies the
// getItem/setItem/removeItem AsyncStorage contract with no extra (de)serialization.
const idbAsyncStorage = {
  getItem: (key: string) => get<string>(key, idbStore).then((value) => value ?? null),
  setItem: (key: string, value: string) => set(key, value, idbStore),
  removeItem: (key: string) => del(key, idbStore),
};

const OFFLINE_CACHE_KEY = "vgt-offline-cache";

const persister = createAsyncStoragePersister({
  storage: idbAsyncStorage,
  key: OFFLINE_CACHE_KEY,
});

// Deletes the cached library from IndexedDB when a session ends (logout or expiry), so the
// next person on a shared computer can't read it. Best-effort: there may be no IndexedDB
// (tests, some private windows).
export function clearOfflineCache(): void {
  try {
    void del(OFFLINE_CACHE_KEY, idbStore).catch(() => undefined);
  } catch {
    // No IndexedDB here, so nothing was cached either.
  }
}

export const offlinePersistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
};
