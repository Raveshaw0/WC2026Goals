"use client";

import { useEffect, useState } from "react";

import { useUserState } from "@/hooks/useUserState";
import { isInLiveWindow } from "@/lib/liveWindow";
import type { Match } from "@/lib/types";

const SBS_COLLECTION =
  "https://www.sbs.com.au/collection/sbs-sport-fifa-world-cup-2026";

function sbsSearchUrl(match: Match): string {
  const q = encodeURIComponent(
    `highlights ${match.home.name} ${match.away.name}`
  );
  return `https://www.sbs.com.au/ondemand/search?query=${q}`;
}

// The buttons always work: live falls back to the SBS World Cup collection,
// highlights falls back to a prefilled SBS search, until per-match URLs are
// discovered (or pasted into the sbs_links table).
export function SbsButtons({
  match,
  liveUrl,
  highlightsUrl,
}: {
  match: Match;
  liveUrl: string | null;
  highlightsUrl: string | null;
}) {
  const { markWatched } = useUserState();
  // Re-evaluate the window every 30s so the button appears/disappears without
  // a reload while the page is open around kickoff.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const inWindow = isInLiveWindow(match, now);
  const finished = match.status === "finished";

  if (inWindow) {
    return (
      <a
        href={liveUrl ?? SBS_COLLECTION}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-bold text-surface transition-opacity hover:opacity-90"
      >
        Watch live on SBS
        {!liveUrl && (
          <span className="block text-xs font-normal opacity-75">
            Opens the SBS World Cup page
          </span>
        )}
      </a>
    );
  }

  if (finished) {
    if (highlightsUrl) {
      return (
        <a
          href={highlightsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => markWatched(match.id)}
          className="block rounded-xl bg-accent/15 px-4 py-3 text-center text-sm font-bold text-accent transition-colors hover:bg-accent/25"
        >
          Highlights on SBS
        </a>
      );
    }
    return (
      <a
        href={sbsSearchUrl(match)}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl border border-edge px-4 py-3 text-center text-sm font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent"
      >
        Search SBS highlights
        <span className="block text-xs font-normal text-zinc-500">
          Direct link appears here once SBS publishes it
        </span>
      </a>
    );
  }

  return null;
}
