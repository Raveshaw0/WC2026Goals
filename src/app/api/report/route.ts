import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// "Something is broken" reports, emailed via Resend. The dedicated wc26
// Resend account (alexanderlukic84@gmail.com) sends from the onboarding
// address to its own inbox, which needs no domain verification. If a domain
// is verified later, override both via env.
const TO = process.env.REPORT_TO_EMAIL ?? "alexanderlukic84@gmail.com";
const FROM =
  process.env.REPORT_FROM_EMAIL ?? "WC26 Tracker <onboarding@resend.dev>";

// 5 reports per minute per IP, in-memory per instance.
const WINDOW_MS = 60_000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(req: NextRequest): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 1000) hits.clear();
  return list.length > LIMIT;
}

export async function POST(req: NextRequest) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "reporting not configured" }, { status: 503 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const page = typeof body?.page === "string" ? body.page.slice(0, 200) : "";
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "message required, max 2000 chars" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: "WC26 tracker: something is broken",
        text: `Page: ${page || "unknown"}\nTime: ${new Date().toISOString()}\n\n${message}`,
      }),
    });
    if (!res.ok) {
      console.error("[report] resend failed:", res.status, await res.text());
      return NextResponse.json({ error: "send failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[report] send error:", err);
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
}
