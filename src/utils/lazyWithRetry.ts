import { lazy, ComponentType } from "react";

/**
 * Lazy import that survives stale chunk hashes after a new deploy.
 * Retries once, then forces a one-time hard reload to fetch the new manifest.
 */
const RELOAD_KEY = "anka:chunk-reloaded";

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      // second attempt (transient network / cache miss)
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      } catch (err2) {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // never resolves; page is reloading
          return new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
