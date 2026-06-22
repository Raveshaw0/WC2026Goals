import { NextRequest, NextResponse } from "next/server";

import { dbConfigured } from "@/lib/supabase-rest";
import {
  browserOf,
  channelOf,
  createPageview,
  deviceOf,
  insertEvents,
  isBot,
  osOf,
  patchEngagement,
  refHost,
  type EventInsert,
} from "@/lib/track-server";

export const dynamic = "force-dynamic";

const SITE = "wc26";

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.length ? v.slice(0, max) : null;
const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
};

export async function POST(req: NextRequest) {
  if (!dbConfigured()) return new NextResponse(null, { status: 204 });

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(await req.text()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const t = body.t;

  if (t === "eng") {
    const id = str(body.id, 64);
    if (id) {
      await patchEngagement(id, {
        active_ms: num(body.active_ms, 0, 86_400_000) ?? undefined,
        max_scroll: num(body.max_scroll, 0, 100) ?? undefined,
        deepest_section: str(body.deepest_section, 200) ?? undefined,
      });
    }
    return new NextResponse(null, { status: 204 });
  }

  if (t === "ev") {
    const raw = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
    const visitor = str(body.visitor, 64);
    const session = str(body.session, 64);
    const rows: EventInsert[] = [];
    for (const e of raw) {
      const ev = e as Record<string, unknown>;
      const type = str(ev.type, 40);
      if (!type) continue;
      rows.push({
        pageview_id: str(ev.pageview_id, 64),
        site: SITE,
        type,
        path: str(ev.path, 300),
        target: str(ev.target, 500),
        value: num(ev.value, -1e9, 1e9),
        meta: ev.meta && typeof ev.meta === "object" ? (ev.meta as Record<string, unknown>) : null,
        visitor,
        session_id: session,
      });
    }
    await insertEvents(rows);
    return new NextResponse(null, { status: 204 });
  }

  const ref = str(body.ref, 500);
  const utm = (body.utm ?? {}) as Record<string, unknown>;
  const utmMedium = str(utm.medium, 80);
  const screen = Array.isArray(body.screen) ? body.screen : [];
  const viewport = Array.isArray(body.viewport) ? body.viewport : [];

  const id = await createPageview({
    site: SITE,
    path: str(body.path, 300),
    ref,
    ref_host: refHost(ref),
    channel: channelOf(ref, utmMedium),
    utm_source: str(utm.source, 80),
    utm_medium: utmMedium,
    utm_campaign: str(utm.campaign, 120),
    utm_content: str(utm.content, 120),
    utm_term: str(utm.term, 120),
    visitor: str(body.visitor, 64),
    session_id: str(body.session, 64),
    is_entry: body.is_entry === true,
    country: req.headers.get("x-vercel-ip-country"),
    region: req.headers.get("x-vercel-ip-country-region"),
    city: req.headers.get("x-vercel-ip-city"),
    timezone: str(body.tz, 64) ?? req.headers.get("x-vercel-ip-timezone"),
    device: deviceOf(ua),
    os: osOf(ua),
    browser: browserOf(ua),
    screen_w: num(screen[0], 0, 20000),
    screen_h: num(screen[1], 0, 20000),
    viewport_w: num(viewport[0], 0, 20000),
    viewport_h: num(viewport[1], 0, 20000),
    lang: str(body.lang, 20),
    is_bot: isBot(ua),
  });

  return NextResponse.json({ id });
}
