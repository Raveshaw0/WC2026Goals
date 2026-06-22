import "server-only";

import { sb } from "./supabase-rest";

// Server-side write layer for the enriched analytics model. All UA / geo / bot
// classification happens here (never trusted from the client).

// ---- UA parsing ------------------------------------------------------------

const BOT_RE =
  /bot|crawl|spider|slurp|mediapartners|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|slackbot|discordbot|headless|phantomjs|puppeteer|playwright|python-requests|axios|curl|wget|libwww|lighthouse|gtmetrix|pingdom|uptimerobot|datadog|semrush|ahrefs|dotbot|petalbot|applebot|google-inspectiontool/i;

export function isBot(ua: string): boolean {
  return !ua || BOT_RE.test(ua);
}

export function deviceOf(ua: string): string {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|webOS/i.test(ua)) return "mobile";
  return "desktop";
}

export function osOf(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "other";
}

export function browserOf(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Firefox\//i.test(ua) && !/Seamonkey/i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Chromium\//i.test(ua)) return "Chromium";
  if (/Version\/.*Safari/i.test(ua)) return "Safari";
  return "other";
}

// ---- referrer -> host + channel -------------------------------------------

export function refHost(ref: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function channelOf(ref: string | null, utmMedium: string | null): string {
  if (utmMedium) {
    const m = utmMedium.toLowerCase();
    if (/cpc|ppc|paid/.test(m)) return "paid";
    if (/email|newsletter/.test(m)) return "email";
    if (/social/.test(m)) return "social";
    if (/referr?al/.test(m)) return "referral";
  }
  const h = (ref ?? "").toLowerCase();
  if (!h) return "direct";
  if (/linkedin|lnkd\.in|t\.co|twitter|x\.com|facebook|instagram|reddit|youtube|tiktok|mastodon|threads/.test(h)) return "social";
  if (/google\.|bing\.|duckduckgo|ecosia|yahoo|baidu|yandex|search/.test(h)) return "search";
  return "referral";
}

// ---- writes ----------------------------------------------------------------

export interface PageviewInsert {
  site: string;
  path: string | null;
  ref: string | null;
  ref_host: string | null;
  channel: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  visitor: string | null;
  session_id: string | null;
  is_entry: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  device: string;
  os: string;
  browser: string;
  screen_w: number | null;
  screen_h: number | null;
  viewport_w: number | null;
  viewport_h: number | null;
  lang: string | null;
  is_bot: boolean;
}

// Insert a pageview and return its id (needed so events + the exit patch can
// reference it).
export async function createPageview(row: PageviewInsert): Promise<string | null> {
  const res = await sb(`/analytics_pageviews`, {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(row),
  });
  if (!res || !res.ok) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function patchEngagement(
  id: string,
  patch: { active_ms?: number; max_scroll?: number; deepest_section?: string | null },
): Promise<void> {
  await sb(`/analytics_pageviews?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify(patch),
  });
}

export interface EventInsert {
  pageview_id: string | null;
  site: string;
  type: string;
  path: string | null;
  target: string | null;
  value: number | null;
  meta: Record<string, unknown> | null;
  visitor: string | null;
  session_id: string | null;
}

export async function insertEvents(rows: EventInsert[]): Promise<void> {
  if (rows.length === 0) return;
  await sb(`/analytics_events`, {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify(rows),
  });
}
