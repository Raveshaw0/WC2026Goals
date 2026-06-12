"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { HighlightsModal } from "@/components/HighlightsModal";
import { useUserState } from "@/hooks/useUserState";
import { melbourneTime } from "@/lib/time";
import type { Match, TeamSide } from "@/lib/types";

function Flag({ team, size = 24 }: { team: TeamSide; size?: number }) {
  if (!team.flag) {
    return (
      <span
        className="inline-block rounded-sm bg-cardSoft"
        style={{ width: size, height: size * 0.75 }}
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.flag}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="inline-block h-auto rounded-sm"
      style={{ width: size }}
    />
  );
}

// "1d 4h 23m" style countdown, recomputed every minute. Client-only after
// mount so the server-rendered HTML (which has no stable "now") matches.
function useKickoffCountdown(kickoffIso: string, enabled: boolean): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setText(null);
      return;
    }
    const compute = () => {
      const diff = new Date(kickoffIso).getTime() - Date.now();
      if (diff <= 0) {
        setText("kickoff soon");
        return;
      }
      const mins = Math.floor(diff / 60_000);
      const d = Math.floor(mins / 1440);
      const h = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      const parts = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
      setText(`kickoff in ${parts}`);
    };
    compute();
    const t = setInterval(compute, 60_000);
    return () => clearInterval(t);
  }, [kickoffIso, enabled]);
  return text;
}

function StatusPill({ match }: { match: Match }) {
  const countdown = useKickoffCountdown(
    match.kickoff,
    match.status === "scheduled"
  );
  if (match.status === "live") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-live">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-live" />
        {match.displayClock || "Live"}
      </span>
    );
  }
  if (match.status === "halftime") {
    return <span className="text-xs font-semibold text-amber-400">HT</span>;
  }
  if (match.status === "finished") {
    return <span className="text-xs font-medium text-zinc-500">FT</span>;
  }
  if (match.status === "postponed") {
    return <span className="text-xs font-medium text-zinc-500">Postponed</span>;
  }
  return (
    <span className="text-xs font-medium text-zinc-400">
      {melbourneTime(match.kickoff)}
      {countdown && (
        <span className="ml-1 text-zinc-600">({countdown})</span>
      )}
    </span>
  );
}

function TeamRow({ team, match }: { team: TeamSide; match: Match }) {
  const started = match.status !== "scheduled" && match.status !== "postponed";
  return (
    <div className="flex items-center gap-2.5">
      <Flag team={team} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
        {team.name}
      </span>
      {started && (
        <span
          className={
            "text-base font-bold tabular-nums " +
            (team.winner ? "text-zinc-100" : "text-zinc-400")
          }
        >
          {team.score ?? "-"}
          {team.shootoutScore !== null && (
            <span className="ml-1 text-xs font-medium text-zinc-500">
              ({team.shootoutScore})
            </span>
          )}
        </span>
      )}
    </div>
  );
}

const ROUND_LABELS: Record<string, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarter-final",
  semifinals: "Semi-final",
  "3rd-place-match": "Third place",
  final: "Final",
};

export function MatchCard({ match }: { match: Match }) {
  const { watched, favourites, toggleWatched, toggleFavourite, markWatched } =
    useUserState();
  const isWatched = watched.has(match.id);
  const isFavourite = favourites.has(match.id);
  const finished = match.status === "finished";
  // The pill plays the YouTube highlights in a popup so people stay here.
  const ytId = finished ? match.sbs?.ytHighlightsId ?? null : null;
  const [playerOpen, setPlayerOpen] = useState(false);

  const contextLabel =
    match.group !== null
      ? `Group ${match.group}`
      : ROUND_LABELS[match.round] ?? "";

  return (
    <div
      className={
        "relative rounded-2xl border bg-card " +
        (isWatched ? "border-accent/40 ring-1 ring-accent/25" : "border-edge")
      }
    >
      <Link
        href={`/match/${match.id}`}
        className={
          "block px-4 py-3 transition-opacity " +
          (isWatched ? "opacity-50" : "")
        }
        aria-label={`${match.home.name} v ${match.away.name}`}
      >
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>{contextLabel}</span>
          <StatusPill match={match} />
        </div>
        <div
          className={
            "space-y-1.5 " + (ytId ? "pr-32" : finished ? "pr-20" : "pr-12")
          }
        >
          <TeamRow team={match.home} match={match} />
          <TeamRow team={match.away} match={match} />
        </div>
      </Link>

      <div className="absolute bottom-3 right-3 flex items-center gap-1">
        {ytId && (
          <button
            type="button"
            aria-label="Play highlights"
            onClick={() => {
              setPlayerOpen(true);
              markWatched(match.id);
            }}
            className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/25"
          >
            <PlayIcon />
            3m
          </button>
        )}
        {finished && (
          <button
            type="button"
            aria-label={isWatched ? "Mark as not watched" : "Mark as watched"}
            aria-pressed={isWatched}
            onClick={() => toggleWatched(match.id)}
            className={
              "rounded-full p-1.5 transition-colors " +
              (isWatched
                ? "text-accent"
                : "text-zinc-600 hover:text-zinc-300")
            }
          >
            <EyeIcon />
          </button>
        )}
        <button
          type="button"
          aria-label={isFavourite ? "Remove favourite" : "Add favourite"}
          aria-pressed={isFavourite}
          onClick={() => toggleFavourite(match.id)}
          className={
            "rounded-full p-1.5 transition-colors " +
            (isFavourite ? "text-amber-400" : "text-zinc-600 hover:text-zinc-300")
          }
        >
          <StarIcon filled={isFavourite} />
        </button>
      </div>

      {isWatched && (
        <span className="absolute left-3 top-0 -translate-y-1/2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-surface">
          <span className="flex items-center gap-0.5">
            <TickIcon /> Watched
          </span>
        </span>
      )}

      {playerOpen && ytId && (
        <HighlightsModal
          videoId={ytId}
          title={`${match.home.name} v ${match.away.name} highlights`}
          onClose={() => setPlayerOpen(false)}
        />
      )}
    </div>
  );
}

export function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      <polygon points="6 3 21 12 6 21" />
    </svg>
  );
}

export function TickIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export { Flag };
