import "server-only";

import type { SbsLinkRow, UserStateRow } from "./types";

// Thin PostgREST wrapper. Service role key, server-side only. No Supabase
// client library: two tables and a handful of queries do not justify a
// dependency, and the browser must never see this key anyway.
//
// Every function degrades gracefully when env vars are missing or Supabase is
// down: reads return null/[], writes no-op. The app must keep working without
// the database (match data does not depend on it).

function env(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function rest(
  path: string,
  init: RequestInit & { prefer?: string } = {}
): Promise<Response | null> {
  const e = env();
  if (!e) return null;
  const headers: Record<string, string> = {
    apikey: e.key,
    Authorization: `Bearer ${e.key}`,
    "Content-Type": "application/json",
    ...(init.prefer ? { Prefer: init.prefer } : {}),
  };
  try {
    return await fetch(`${e.url}/rest/v1${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    console.error("[db] request failed:", err);
    return null;
  }
}

// ---- sbs_links ----

export async function getSbsLink(matchId: string): Promise<SbsLinkRow | null> {
  const res = await rest(`/sbs_links?match_id=eq.${encodeURIComponent(matchId)}&limit=1`);
  if (!res || !res.ok) return null;
  const rows = (await res.json()) as SbsLinkRow[];
  return rows[0] ?? null;
}

export async function getSbsLinks(matchIds: string[]): Promise<SbsLinkRow[]> {
  if (matchIds.length === 0) return [];
  const list = matchIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
  const res = await rest(`/sbs_links?match_id=in.(${encodeURIComponent(list)})`);
  if (!res || !res.ok) return [];
  return (await res.json()) as SbsLinkRow[];
}

export async function getAllSbsLinks(): Promise<SbsLinkRow[]> {
  const res = await rest(`/sbs_links?select=*`);
  if (!res || !res.ok) return [];
  return (await res.json()) as SbsLinkRow[];
}

export async function upsertSbsLink(
  row: Partial<SbsLinkRow> & { match_id: string }
): Promise<boolean> {
  const res = await rest(`/sbs_links?on_conflict=match_id`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  if (!res) return false;
  if (!res.ok) console.error("[db] upsertSbsLink failed:", res.status, await res.text());
  return res.ok;
}

// ---- user_state ----

export async function getUserState(code: string): Promise<UserStateRow | null> {
  const res = await rest(`/user_state?sync_code=eq.${encodeURIComponent(code)}&limit=1`);
  if (!res || !res.ok) return null;
  const rows = (await res.json()) as UserStateRow[];
  return rows[0] ?? null;
}

export async function insertUserState(code: string): Promise<boolean> {
  const res = await rest(`/user_state`, {
    method: "POST",
    body: JSON.stringify({ sync_code: code, watched: [], favourites: [] }),
    prefer: "return=minimal",
  });
  return Boolean(res && res.ok);
}

export async function updateUserState(
  code: string,
  watched: string[],
  favourites: string[],
  favouriteTeams: string[]
): Promise<boolean> {
  const res = await rest(`/user_state?sync_code=eq.${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify({
      watched,
      favourites,
      favourite_teams: favouriteTeams,
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });
  if (!res) return false;
  if (!res.ok) console.error("[db] updateUserState failed:", res.status, await res.text());
  return res.ok;
}

export function dbConfigured(): boolean {
  return env() !== null;
}
