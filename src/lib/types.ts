// Internal types. The rest of the app only ever sees these; ESPN's schema
// stays inside lib/espn.ts so the data source can be swapped later.

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "break" // knockout mid-match pause: end of regulation, ET half-time, pre-shootout
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
  clock: number; // ESPN match clock in seconds (for live minute interpolation)
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
  position: string; // ESPN abbreviation, e.g. "G", "RB", "AM-L"
  formationPlace: number; // ESPN slot 1..11 (tiebreak for pitch layout)
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

export type MatchEventType =
  | "goal"
  | "yellow"
  | "red"
  | "sub"
  | "halftime"
  | "fulltime";

export interface MatchEvent {
  minute: string; // "67'", "90'+2'"
  type: MatchEventType;
  side: "home" | "away" | "neutral";
  player: string | null; // scorer / carded player / player coming on
  secondary: string | null; // assister / player coming off
  penalty: boolean;
  ownGoal: boolean;
  homeScore: number | null; // running score, set on goals and period rows
  awayScore: number | null;
}

export interface MatchStatPair {
  label: string;
  home: string;
  away: string;
  homePct: number; // 0..1 share for the bar split
}

// One penalty in a shootout, in the order taken.
export interface ShootoutShot {
  player: string;
  scored: boolean;
}

// A team's shootout column. teamId maps to match.home.id / match.away.id.
export interface ShootoutTeam {
  teamId: string;
  shots: ShootoutShot[];
}

export interface MatchSummary {
  lineups: TeamLineup[]; // empty when not yet published
  events: MatchEvent[]; // empty until kickoff
  stats: MatchStatPair[]; // empty until ESPN publishes the boxscore
  shootout: ShootoutTeam[]; // empty unless the match went to penalties
}

export interface StandingRow {
  teamId: string;
  name: string;
  flag: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
}

export interface GroupStanding {
  group: string; // "A".."L"
  rows: StandingRow[];
}

export interface LeaderRow {
  name: string;
  teamId: string;
  teamName: string;
  flag: string | null;
  value: number;
  secondary: number; // assists: 0; discipline: red cards; scorers: 0
}

export interface LeadersPayload {
  scorers: LeaderRow[];
  assists: LeaderRow[];
  discipline: LeaderRow[]; // value = yellows, secondary = reds
  lastUpdated: string;
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
  favourite_teams: string[];
  updated_at: string;
}
