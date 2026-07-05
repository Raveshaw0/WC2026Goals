// Knockout bracket derivation. Pure transform over the Match[] we already pull
// from ESPN (via fetchAllMatches) — no new data source. Safe to import on both
// server and client, so the page renders once and the client re-derives from
// live-polled matches to keep scores moving.
//
// WHY a fixed skeleton: ESPN's scoreboard gives every knockout match tagged by
// round with real teams (once decided) or placeholder names ("Round of 16 1
// Winner") while undecided, but it never returns the bracket LINKAGE — which
// match feeds which. That wiring is fixed for WC2026, so we encode it once here
// and let ESPN fill each slot. The feeder maps below were reconstructed from
// the live feed: R32 winners flow into these R16 slots (verified by team
// identity) and ESPN's own "Round of 16 N Winner" / "Quarterfinal N Winner"
// placeholders confirm the R16 -> QF -> SF -> Final wiring. verifyStructure()
// re-checks the whole chain against live results on every build, so a wrong
// map or an ESPN renumbering trips a flag instead of drawing a silent lie.

import type { Match } from "./types";

export type BracketRound =
  | "round-of-32"
  | "round-of-16"
  | "quarterfinals"
  | "semifinals"
  | "final"
  | "3rd-place-match";

export interface BracketSlot {
  id: string; // "R32-1".."R32-16", "R16-1".."R16-8", "QF-1".."QF-4", "SF-1"/"SF-2", "F", "TP"
  round: BracketRound;
  label: string; // compact human tag, e.g. "R16 M1", "QF1", "Final"
  match: Match | null; // bound ESPN match, or null if the slot has no fixture yet
  feederA: string | null; // slot id whose winner fills the home side (null for R32 leaves)
  feederB: string | null; // slot id whose winner fills the away side
}

export interface BracketData {
  slots: Record<string, BracketSlot>;
  leftColumns: string[][]; // [R32, R16, QF, SF] slot ids, top-to-bottom, left half
  rightColumns: string[][]; // mirror for the right half
  finalId: string;
  thirdPlaceId: string;
  hasFixtures: boolean; // any knockout match exists yet
  consistent: boolean; // structure verified against live results
}

// Feeder maps use date-order indices within each round, which is how ESPN
// numbers its slots. Fixed for the tournament.
const R16_FEEDERS: Record<string, [number, number]> = {
  "R16-1": [1, 4],
  "R16-2": [3, 6],
  "R16-3": [2, 5],
  "R16-4": [7, 8],
  "R16-5": [12, 11],
  "R16-6": [10, 9],
  "R16-7": [15, 14],
  "R16-8": [13, 16],
};
const QF_FEEDERS: Record<string, [number, number]> = {
  "QF-1": [1, 2],
  "QF-2": [5, 6],
  "QF-3": [3, 4],
  "QF-4": [7, 8],
};
const SF_FEEDERS: Record<string, [number, number]> = {
  "SF-1": [1, 2],
  "SF-2": [3, 4],
};

// Column render order, top -> bottom. Ordered so paired feeders sit adjacent
// and no connector lines cross.
const LEFT_R32 = [1, 4, 3, 6, 12, 11, 10, 9];
const RIGHT_R32 = [2, 5, 7, 8, 15, 14, 13, 16];
const LEFT_R16 = ["R16-1", "R16-2", "R16-5", "R16-6"];
const RIGHT_R16 = ["R16-3", "R16-4", "R16-7", "R16-8"];
const LEFT_QF = ["QF-1", "QF-2"];
const RIGHT_QF = ["QF-3", "QF-4"];

const byKickoff = (a: Match, b: Match) => a.kickoff.localeCompare(b.kickoff);

function decided(m: Match | null): boolean {
  return !!m && m.status === "finished" && (m.home.winner || m.away.winner);
}

export function winnerId(m: Match | null): string | null {
  if (!m) return null;
  if (m.home.winner) return m.home.id;
  if (m.away.winner) return m.away.id;
  return null;
}

function loserId(m: Match | null): string | null {
  if (!m) return null;
  if (m.home.winner) return m.away.id;
  if (m.away.winner) return m.home.id;
  return null;
}

const setEq = (a: Set<string | null>, b: Set<string | null>) =>
  a.size === b.size && Array.from(a).every((x) => b.has(x));

// Re-derive the whole chain from live results and confirm each decided slot's
// two teams really are the winners (or losers, for third place) of its feeders.
// Only checks slots where both the slot and its feeders have finished with real
// teams, so it is silent until there is something to verify.
function verifyStructure(slots: Record<string, BracketSlot>): boolean {
  let ok = true;
  for (const s of Object.values(slots)) {
    if (!s.feederA || !s.feederB || !s.match) continue;
    if (!s.match.home.flag || !s.match.away.flag) continue; // slot still placeholder
    const a = slots[s.feederA]?.match ?? null;
    const b = slots[s.feederB]?.match ?? null;
    if (!decided(a) || !decided(b)) continue;
    const expected =
      s.id === "TP"
        ? new Set([loserId(a), loserId(b)])
        : new Set([winnerId(a), winnerId(b)]);
    const actual = new Set<string | null>([s.match.home.id, s.match.away.id]);
    if (!setEq(expected, actual)) {
      ok = false;
      console.error(
        `[bracket] structure mismatch at ${s.id}: expected ${Array.from(
          expected
        ).join("/")}, got ${Array.from(actual).join("/")}`
      );
    }
  }
  return ok;
}

export function buildBracket(all: Match[]): BracketData {
  const inRound = (r: Match["round"]) =>
    all.filter((m) => m.round === r).sort(byKickoff);
  const r32 = inRound("round-of-32");
  const r16 = inRound("round-of-16");
  const qf = inRound("quarterfinals");
  const sf = inRound("semifinals");
  const finalM = inRound("final")[0] ?? null;
  const tpM = inRound("3rd-place-match")[0] ?? null;

  const slots: Record<string, BracketSlot> = {};

  // R32 leaves — bound in date order, padded to 16 so the tree always renders.
  for (let i = 1; i <= 16; i++) {
    const id = `R32-${i}`;
    slots[id] = {
      id,
      round: "round-of-32",
      label: `R32 M${i}`,
      match: r32[i - 1] ?? null,
      feederA: null,
      feederB: null,
    };
  }
  Object.keys(R16_FEEDERS).forEach((id, i) => {
    const [a, b] = R16_FEEDERS[id];
    slots[id] = {
      id,
      round: "round-of-16",
      label: `R16 M${i + 1}`,
      match: r16[i] ?? null,
      feederA: `R32-${a}`,
      feederB: `R32-${b}`,
    };
  });
  Object.keys(QF_FEEDERS).forEach((id, i) => {
    const [a, b] = QF_FEEDERS[id];
    slots[id] = {
      id,
      round: "quarterfinals",
      label: `QF${i + 1}`,
      match: qf[i] ?? null,
      feederA: `R16-${a}`,
      feederB: `R16-${b}`,
    };
  });
  Object.keys(SF_FEEDERS).forEach((id, i) => {
    const [a, b] = SF_FEEDERS[id];
    slots[id] = {
      id,
      round: "semifinals",
      label: `SF${i + 1}`,
      match: sf[i] ?? null,
      feederA: `QF-${a}`,
      feederB: `QF-${b}`,
    };
  });
  slots["F"] = {
    id: "F",
    round: "final",
    label: "Final",
    match: finalM,
    feederA: "SF-1",
    feederB: "SF-2",
  };
  slots["TP"] = {
    id: "TP",
    round: "3rd-place-match",
    label: "3rd place",
    match: tpM,
    feederA: "SF-1",
    feederB: "SF-2",
  };

  return {
    slots,
    leftColumns: [LEFT_R32.map((n) => `R32-${n}`), LEFT_R16, LEFT_QF, ["SF-1"]],
    // Inner -> outer so the right half cascades INWARD toward the centre: SF-2
    // sits beside the Final, R32 on the far edge. This mirrors the left half and
    // matches RIGHT_LABELS + the right-side connectors (forward line points left,
    // toward the Final).
    rightColumns: [
      ["SF-2"],
      RIGHT_QF,
      RIGHT_R16,
      RIGHT_R32.map((n) => `R32-${n}`),
    ],
    finalId: "F",
    thirdPlaceId: "TP",
    hasFixtures: r32.length + r16.length + qf.length + sf.length > 0 || !!finalM,
    consistent: verifyStructure(slots),
  };
}
