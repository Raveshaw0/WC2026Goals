"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Anonymous first-party page-view beacon. One ping per navigation with the
// path, referrer, and a random per-browser id (no cookies, no PII). Uses
// sendBeacon so it never delays the page. Counts real humans, not the bots
// that crawl any public URL.
const VID_KEY = "wc26.vid";

export function Beacon() {
  const pathname = usePathname();
  useEffect(() => {
    let vid: string | null = null;
    try {
      vid = localStorage.getItem(VID_KEY);
      if (!vid) {
        vid =
          Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(VID_KEY, vid);
      }
    } catch {
      // private mode / storage blocked: still count the view, just no id
    }
    const body = JSON.stringify({
      path: pathname,
      referrer: document.referrer || null,
      visitor: vid,
    });
    try {
      const ok =
        typeof navigator !== "undefined" &&
        "sendBeacon" in navigator &&
        navigator.sendBeacon(
          "/api/track",
          new Blob([body], { type: "application/json" })
        );
      if (!ok) throw new Error("no beacon");
    } catch {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
