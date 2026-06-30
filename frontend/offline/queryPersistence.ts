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

const persister = createAsyncStoragePersister({
  storage: idbAsyncStorage,
  key: "vgt-offline-cache",
});

export const offlinePersistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
};
