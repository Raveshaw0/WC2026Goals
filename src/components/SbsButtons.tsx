"use client";

import { useEffect, useState } from "react";

import { useUserState } from "@/hooks/useUserState";
import { isInLiveWindow } from "@/lib/liveWindow";
import type { Match, SbsMatchLinks } from "@/lib/types";

const SBS_COLLECTION =
  "https://www.sbs.com.au/ondemand/fifa-world-cup-2026";

function sbsSearchUrl(match: Match): string {
  const q = encodeURIComponent(
    `highlights ${match.home.name} ${match.away.name}`
  );
  return `https://www.sbs.com.au/ondemand/search?query=${q}`;
}

const EMPTY: SbsMatchLinks = {
  live: null,
  highlights: null,
  extended: null,
  full: null,
  ytHighlightsId: null,
};

// During the live window: one prominent live button (falls back to the SBS
// World Cup hub so it always works). Post match: Highlights, Extended,
// Full Match in that order, plus a search fallback until links land.
export function SbsButtons({ match }: { match: Match }) {
  const { markWatched } = useUserState();
  const links = match.sbs ?? EMPTY;

  // Re-evaluate the window every 30s so the button appears/disappears without
  // a reload while the page is open around kickoff.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const inWindow = isInLiveWindow(match, now);
  const finished = match.status === "finished";

  const heading = (
    <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
      SBS links
      <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-500">
        (requires SBS login)
      </span>
    </h2>
  );

  if (inWindow) {
    return (
      <section>
        {heading}
        <a
          href={links.live ?? SBS_COLLECTION}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-bold text-surface transition-opacity hover:opacity-90"
        >
          Watch live on SBS
          {!links.live && (
            <span className="block text-xs font-normal opacity-75">
              Opens the SBS World Cup hub
            </span>
          )}
        </a>
      </section>
    );
  }

  if (!finished) return null;

  const buttons = [
    { label: "Highlights", note: "3 min", url: links.highlights },
    { label: "Extended", note: "12 min", url: links.extended },
    { label: "Full Match", note: "replay", url: links.full },
  ];
  const anyLink = buttons.some((b) => b.url);

  return (
    <section className="space-y-2">
      {heading}
      <div className="grid grid-cols-3 gap-2">
        {buttons.map((b) =>
          b.url ? (
            <a
              key={b.label}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markWatched(match.id)}
              className="rounded-xl bg-accent/15 px-2 py-3 text-center transition-colors hover:bg-accent/25"
            >
              <span className="block text-sm font-bold text-accent">
                {b.label}
              </span>
              <span className="block text-xs text-accent/70">{b.note}</span>
            </a>
          ) : (
            <div
              key={b.label}
              className="rounded-xl border border-edge px-2 py-3 text-center opacity-50"
            >
              <span className="block text-sm font-medium text-zinc-500">
                {b.label}
              </span>
              <span className="block text-xs text-zinc-600">soon</span>
            </div>
          )
        )}
      </div>
      {!anyLink && (
        <a
          href={sbsSearchUrl(match)}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border border-edge px-4 py-2.5 text-center text-sm font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent"
        >
          Search SBS On Demand
          <span className="block text-xs font-normal text-zinc-500">
            Buttons activate once SBS publishes the videos
          </span>
        </a>
      )}
    </section>
  );
}
