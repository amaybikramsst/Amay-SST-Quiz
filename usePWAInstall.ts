import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithRelatedApps extends Navigator {
  getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
}

const INSTALLED_STORAGE_KEY = "amaysst_pwa_installed";

function checkStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function hasSavedInstallFlag(): boolean {
  try {
    return localStorage.getItem(INSTALLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markInstalledInStorage(): void {
  try {
    localStorage.setItem(INSTALLED_STORAGE_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

function clearInstalledInStorage(): void {
  try {
    localStorage.removeItem(INSTALLED_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return checkStandalone() || hasSavedInstallFlag();
  });
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (checkStandalone()) {
      setIsInstalled(true);
      markInstalledInStorage();
    } else if (hasSavedInstallFlag()) {
      setIsInstalled(true);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    // Check Android Chrome's actual installed WebAPK list so uninstalling restores the Install button
    const syncRelatedApps = () => {
      if (checkStandalone()) {
        setIsInstalled(true);
        markInstalledInStorage();
        return;
      }
      const nav = window.navigator as NavigatorWithRelatedApps;
      if (typeof nav.getInstalledRelatedApps !== "function") return;
      nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            setIsInstalled(true);
            setDeferredPrompt(null);
            markInstalledInStorage();
          } else if (
            Array.isArray(apps) &&
            apps.length === 0 &&
            /android/i.test(window.navigator.userAgent) &&
            window.location.hostname.endsWith("github.io")
          ) {
            clearInstalledInStorage();
            setIsInstalled(false);
          }
        })
        .catch(() => {
          // ignore browser API errors
        });
    };

    syncRelatedApps();

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (checkStandalone()) {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return;
      }
      // Browser only fires beforeinstallprompt when the PWA is NOT currently installed
      clearInstalledInStorage();
      setIsInstalled(false);
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      markInstalledInStorage();
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        onAppInstalled();
      }
    };

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        syncRelatedApps();
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("focus", syncRelatedApps);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    mediaQuery.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("focus", syncRelatedApps);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      mediaQuery.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        markInstalledInStorage();
        return "accepted";
      }
      return "dismissed";
    } catch {
      return "unavailable";
    }
  }, [deferredPrompt]);

  return {
    canNativeInstall: !!deferredPrompt,
    isInstalled,
    isIOS,
    isInAppBrowser: checkInAppBrowser(),
    externalBrowserUrl: getExternalBrowserUrl(),
    install,
  };
}

function checkInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (checkStandalone()) return false;
  const ua = window.navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|WhatsApp|Snapchat|BytedanceWebview|TikTok|musical_ly|Line\/|Twitter|LinkedInApp|MicroMessenger|GSA\/|; wv\b/i.test(
    ua
  );
}

function getExternalBrowserUrl(): string {
  if (typeof window === "undefined") return "";
  const ua = window.navigator.userAgent || "";
  const loc = window.location;
  if (/Android/i.test(ua)) {
    const scheme = loc.protocol.replace(":", "") || "https";
    const target = `${loc.host}${loc.pathname}${loc.search}${loc.hash}`;
    return `intent://${target}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(
      loc.href
    )};end`;
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return `x-safari-${loc.href}`;
  }
  return loc.href;
}
