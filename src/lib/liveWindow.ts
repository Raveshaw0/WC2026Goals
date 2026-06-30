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
  // A match ESPN says is live (incl. halftime and knockout pauses like the
  // pre-extra-time and pre-shootout breaks) is in window regardless of clock
  // maths; a match ESPN says is finished is out of window even if time remains.
  if (
    match.status === "live" ||
    match.status === "halftime" ||
    match.status === "break"
  ) {
    return true;
  }
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

// Milliseconds until the next match's live window opens, or Infinity if none
// upcoming. Lets the idle poller wake exactly at kickoff-minus-5 instead of
// drifting up to a full idle interval behind a starting match.
export function msUntilNextWindow(
  matches: Pick<Match, "kickoff" | "knockout" | "status">[],
  now: number = Date.now()
): number {
  let soonest = Infinity;
  for (const m of matches) {
    if (m.status === "finished" || m.status === "postponed") continue;
    const { start } = liveWindowFor(m);
    if (start > now && start - now < soonest) soonest = start - now;
  }
  return soonest;
}
