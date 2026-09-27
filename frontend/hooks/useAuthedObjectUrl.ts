import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

// An <img> can't send this app's Bearer header, so authenticated images (e.g. save state
// screenshots) are fetched as a blob through apiClient and shown via an object URL, revoked
// again when the path changes or the component unmounts.
export function useAuthedObjectUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    apiClient
      .get<Blob>(path, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return url;
}
