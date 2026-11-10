import { useSyncExternalStore } from "react";

// Installing VGT as an app (it's a PWA). Chrome, Edge and Android fire beforeinstallprompt soon
// after the page loads when the app can be installed; it's kept here so Settings → App can offer
// an Install button later. Safari and Firefox never fire it, so Settings explains their way.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// installed: running as the installed app. prompt: the browser can install it on a click.
// ios: Safari's Share → Add to Home Screen. insecure: plain http, which browsers won't install.
// manual: the browser's own install option (address bar or menu), if it has one.
export type InstallState = "installed" | "prompt" | "ios" | "insecure" | "manual";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Called once at startup (index.tsx), so the event isn't missed before Settings is opened.
export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    justInstalled = true;
    notify();
  });
}

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPadOS reports itself as a Mac; its touch screen gives it away.
const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function getInstallState(): InstallState {
  if (justInstalled || isStandalone()) return "installed";
  if (deferredPrompt) return "prompt";
  if (isIos()) return "ios";
  if (!window.isSecureContext) return "insecure";
  return "manual";
}

export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return;
  // An event can only prompt once, whatever the answer; the browser fires a new one if the app
  // can still be installed later.
  deferredPrompt = null;
  try {
    await event.prompt();
    await event.userChoice;
  } catch {
    // Already used, or the browser refused; the manual instructions take over.
  }
  notify();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useInstallState = () => useSyncExternalStore(subscribe, getInstallState);
