// Real fullscreen for the Screensaver, where the browser has it (iPhone Safari doesn't: there
// the overlay alone covers the page). The whole page goes fullscreen, not the overlay, so
// dialogs (which MUI renders straight into <body>) still show on top of it.
let entered = false;

export function enterFullscreen(): void {
  const root = document.documentElement;
  if (document.fullscreenElement || typeof root.requestFullscreen !== "function") return;
  entered = true;
  // Refused (no click to ask from, a policy, an iframe): the overlay still covers the page.
  root.requestFullscreen().catch(() => {
    entered = false;
  });
}

// Leaves fullscreen only if enterFullscreen put the page there, never one the user chose.
export function exitFullscreen(): void {
  if (!entered) return;
  entered = false;
  if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
    document.exitFullscreen().catch(() => undefined);
  }
}
