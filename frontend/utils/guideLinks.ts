import { resolveAssetUrl } from "../api/client";
import { createGuideViewLink } from "../api/guides";
import type { Guide } from "../api/types";

// The server's own message on a failed request, when it sent one.
export function serverDetail(error: unknown): string | undefined {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

// Opens a guide's file in a new tab without pop-up blockers stopping it: the tab is opened
// during the click (cut off from this page), then pointed at the signed view link once it
// arrives; it closes again if the link can't be had.
export async function openGuideInNewTab(
  guide: Guide,
  onError: (error: unknown) => void
): Promise<void> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await createGuideViewLink(guide.id);
    const full = resolveAssetUrl(url) ?? url;
    if (tab) tab.location.href = full;
    else window.open(full, "_blank", "noopener,noreferrer");
  } catch (error) {
    tab?.close();
    onError(error);
  }
}
