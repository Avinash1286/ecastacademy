"use client";

import { useEffect } from "react";

const CACHE_NAMES_TO_CLEAR = [
  "start-url",
  "pages",
  "next-data",
  "others",
  "cross-origin",
  "pages-rsc",
  "pages-rsc-prefetch",
  "next-static-js-assets",
  "static-image-assets",
  "static-js-assets",
  "static-style-assets",
  "static-font-assets",
  "static-audio-assets",
  "next-image",
];

export function UnregisterServiceWorker() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator)) return;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));

        if (cancelled) return;

        if ("caches" in window) {
          const existing = await caches.keys();
          const toDelete = existing.filter(
            (name) => CACHE_NAMES_TO_CLEAR.includes(name) || name.startsWith("workbox-")
          );
          await Promise.all(toDelete.map((name) => caches.delete(name)));
        }
      } catch {
        // Best-effort only; never block app rendering.
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
