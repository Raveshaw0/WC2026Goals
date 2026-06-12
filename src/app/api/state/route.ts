import { NextRequest, NextResponse } from "next/server";

import {
  dbConfigured,
  getUserState,
  insertUserState,
  updateUserState,
} from "@/lib/db";
import { randomCode, SYNC_CODE_RE } from "@/lib/words";

export const dynamic = "force-dynamic";

// In-memory rate limit: 30 requests per minute per IP. Per serverless
// instance, which is acceptable for a personal app (see KNOWN_ISSUES.md).
const WINDOW_MS = 60_000;
const LIMIT = 30;
const hits = new Map<string, number[]>();

function rateLimited(req: NextRequest): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 1000) hits.clear(); // bound memory on long-lived instances
  return list.length > LIMIT;
}

function sanitizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return SYNC_CODE_RE.test(code) ? code : null;
}

// Match ids and team ids are both numeric ESPN ids.
function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, 20))
    .filter((x) => /^[0-9]+$/.test(x))
    .slice(0, 300);
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

function payload(
  code: string,
  watched: string[],
  favourites: string[],
  favouriteTeams: string[]
) {
  return { code, watched, favourites, favouriteTeams };
}

export async function GET(req: NextRequest) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: "sync not configured" }, { status: 503 });
  }
  const code = sanitizeCode(req.nextUrl.searchParams.get("code"));
  if (!code) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const row = await getUserState(code);
  if (!row) {
    return NextResponse.json({ error: "unknown code" }, { status: 404 });
  }
  return NextResponse.json(
    payload(
      row.sync_code,
      row.watched ?? [],
      row.favourites ?? [],
      row.favourite_teams ?? []
    )
  );
}

// POST actions:
//   { action: "new" }
//   { action: "adopt", code, watched, favourites, favouriteTeams }
//   { action: "sync", code, watched, favourites, favouriteTeams,
//     removedWatched?, removedFavourites?, removedFavouriteTeams? }
// Merging is union; explicit untoggles arrive as removed* lists so
// reconciliation never silently deletes anything.
export async function POST(req: NextRequest) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: "sync not configured" }, { status: 503 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const action = body?.action;

  if (action === "new") {
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      const existing = await getUserState(code);
      if (existing) continue; // collision, retry
      const ok = await insertUserState(code);
      if (ok) {
        return NextResponse.json(payload(code, [], [], []));
      }
    }
    return NextResponse.json({ error: "could not create code" }, { status: 500 });
  }

  const code = sanitizeCode(body?.code);
  if (!code) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const watched = sanitizeIds(body?.watched);
  const favourites = sanitizeIds(body?.favourites);
  const favouriteTeams = sanitizeIds(body?.favouriteTeams);

  if (action === "adopt") {
    const row = await getUserState(code);
    if (!row) {
      return NextResponse.json({ error: "unknown code" }, { status: 404 });
    }
    const mergedWatched = union(row.watched ?? [], watched);
    const mergedFavourites = union(row.favourites ?? [], favourites);
    const mergedTeams = union(row.favourite_teams ?? [], favouriteTeams);
    await updateUserState(code, mergedWatched, mergedFavourites, mergedTeams);
    return NextResponse.json(
      payload(code, mergedWatched, mergedFavourites, mergedTeams)
    );
  }

  if (action === "sync") {
    const row = await getUserState(code);
    if (!row) {
      return NextResponse.json({ error: "unknown code" }, { status: 404 });
    }
    const removedWatched = new Set(sanitizeIds(body?.removedWatched));
    const removedFavourites = new Set(sanitizeIds(body?.removedFavourites));
    const removedTeams = new Set(sanitizeIds(body?.removedFavouriteTeams));
    const mergedWatched = union(row.watched ?? [], watched).filter(
      (id) => !removedWatched.has(id)
    );
    const mergedFavourites = union(row.favourites ?? [], favourites).filter(
      (id) => !removedFavourites.has(id)
    );
    const mergedTeams = union(row.favourite_teams ?? [], favouriteTeams).filter(
      (id) => !removedTeams.has(id)
    );
    await updateUserState(code, mergedWatched, mergedFavourites, mergedTeams);
    return NextResponse.json(
      payload(code, mergedWatched, mergedFavourites, mergedTeams)
    );
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
