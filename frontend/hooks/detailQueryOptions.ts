// Options a detail-page lookup hook (useGame, useDeviceItem, ...) accepts from a caller that
// only displays the result and must not drive fetching itself. The breadcrumb labels in
// navigation/breadcrumbConfig.tsx pass { retryOnMount: false }: they live inside each page's
// frame, so they remount whenever the page switches between its loading and not-found views,
// and retrying a failed lookup on every remount would flip the page back to loading forever.
export interface DetailQueryOptions {
  retryOnMount?: boolean;
}

export const DISPLAY_ONLY: DetailQueryOptions = { retryOnMount: false };
