// Internal types. The rest of the app only ever sees these; ESPN's schema
// stays inside lib/espn.ts so the data source can be swapped later.

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed";

export type Round =
  | "group-stage"
  | "round-of-32"
  | "round-of-16"
  | "quarterfinals"
  | "semifinals"
  | "3rd-place-match"
  | "final";

export interface TeamSide {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  flag: string | null;
  score: number | null;
  shootoutScore: number | null;
  winner: boolean;
}

export interface Goal {
  minute: string; // display form, e.g. "67'" or "90'+3'"
  clockSeconds: number;
  scorer: string;
  teamId: string;
  ownGoal: boolean;
  penalty: boolean;
  shootout: boolean;
}

export interface SbsMatchLinks {
  live: string | null;
  highlights: string | null;
  extended: string | null;
  full: string | null;
  ytHighlightsId: string | null; // YouTube video id from @SBSSportau
}

export interface Match {
  id: string;
  kickoff: string; // ISO UTC
  status: MatchStatus;
  statusDetail: string; // ESPN human detail, e.g. "FT", "HT"
  displayClock: string; // e.g. "67'"
  round: Round;
  group: string | null; // "A".."L" for group stage
  knockout: boolean;
  home: TeamSide;
  away: TeamSide;
  venue: string | null;
  city: string | null;
  goals: Goal[];
  // Merged in server-side from the sbs_links table; absent on /api/live
  // payloads (the polling merge preserves the previous value).
  sbs?: SbsMatchLinks;
}

export interface MatchesPayload {
  matches: Match[];
  stale: boolean;
  lastUpdated: string; // ISO
}

export interface LineupPlayer {
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
}

export interface TeamLineup {
  teamId: string;
  teamName: string;
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchSummary {
  lineups: TeamLineup[]; // empty when not yet published
}

export interface SbsLinkRow {
  match_id: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  match_end: string | null;
  sbs_live_url: string | null;
  sbs_highlights_url: string | null;
  sbs_extended_url: string | null;
  sbs_full_url: string | null;
  sbs_mini_url: string | null;
  yt_highlights_id: string | null;
  last_checked: string | null;
  attempts: number;
  attempts_live: number;
  attempts_highlights: number;
}

export interface UserStateRow {
  sync_code: string;
  watched: string[];
  favourites: string[];
  updated_at: string;
}
