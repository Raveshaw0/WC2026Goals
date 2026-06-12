"use client";

import { melbourneDateTimeShort } from "@/lib/time";

export function StaleBanner({
  stale,
  lastUpdated,
}: {
  stale: boolean;
  lastUpdated: string | null;
}) {
  if (!stale) return null;
  return (
    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      Data may be stale.
      {lastUpdated && lastUpdated !== new Date(0).toISOString() && (
        <> Last updated {melbourneDateTimeShort(lastUpdated)}.</>
      )}
    </div>
  );
}
