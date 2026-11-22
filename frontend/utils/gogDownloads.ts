import { resolveAssetUrl } from "../api/client";
import { createGogDownloadLink } from "../api/integrations";
import { downloadFromUrl } from "./download";

// Saves one installer file from this server to the device. Installers can be many GB, so the
// browser downloads it itself from a short-lived signed link instead of a script holding it.
export async function saveGogDownloadToDevice(downloadId: number): Promise<void> {
  const url = await createGogDownloadLink(downloadId);
  downloadFromUrl(resolveAssetUrl(url) ?? url);
}
