import type { Match } from "./types";

// Live window: kickoff minus 5 minutes through kickoff plus 150 minutes,
// extended to 180 for knockout rounds (extra time and penalties).
const PRE_MS = 5 * 60 * 1000;
const GROUP_MS = 150 * 60 * 1000;
const KNOCKOUT_MS = 180 * 60 * 1000;

export function liveWindowFor(match: Pick<Match, "kickoff" | "knockout">): {
  start: number;
  end: number;
} {
  const ko = new Date(match.kickoff).getTime();
  return {
    start: ko - PRE_MS,
    end: ko + (match.knockout ? KNOCKOUT_MS : GROUP_MS),
  };
}

export function isInLiveWindow(
  match: Pick<Match, "kickoff" | "knockout" | "status">,
  now: number = Date.now()
): boolean {
  // A match ESPN says is live is in window regardless of clock maths; a match
  // ESPN says is finished is out of window even if time remains.
  if (match.status === "live" || match.status === "halftime") return true;
  if (match.status === "finished" || match.status === "postponed") return false;
  const { start, end } = liveWindowFor(match);
  return now >= start && now <= end;
}

export function anyLiveWindow(
  matches: Pick<Match, "kickoff" | "knockout" | "status">[],
  now: number = Date.now()
): boolean {
  return matches.some((m) => isInLiveWindow(m, now));
}
