import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline()
  );
}
