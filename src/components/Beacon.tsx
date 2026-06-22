"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { trackPageview } from "@/lib/track-client";

// Rich first-party pageview on every navigation (full load or SPA route change).
// Writes to the shared analytics model (site = "wc26").
export function Beacon() {
  const pathname = usePathname();
  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);
  return null;
}
