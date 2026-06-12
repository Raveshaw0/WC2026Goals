-- wc26-tracker schema. Run this in the Supabase SQL editor.
-- Access is exclusively server-side via the service role key, so RLS is
-- enabled with no policies: anon and authenticated roles can do nothing,
-- service role bypasses RLS.

create table if not exists sbs_links (
  match_id text primary key,
  home_team text not null,
  away_team text not null,
  kickoff timestamptz not null,
  match_end timestamptz,
  sbs_live_url text,
  sbs_highlights_url text,
  -- Per-cut links from the SBS World Cup hub rails (catalogue API)
  sbs_extended_url text,
  sbs_full_url text,
  sbs_mini_url text,
  -- Short highlights video id from youtube.com/@SBSSportau (embeddable)
  yt_highlights_id text,
  last_checked timestamptz,
  attempts int default 0,
  -- Per-type attempt caps (spec: stop after 20 attempts per match per link
  -- type). attempts above is kept as the total.
  attempts_live int default 0,
  attempts_highlights int default 0
);

create table if not exists user_state (
  sync_code text primary key,
  watched jsonb default '[]',
  favourites jsonb default '[]',
  updated_at timestamptz default now()
);

alter table sbs_links enable row level security;
alter table user_state enable row level security;
