import { NextRequest, NextResponse } from "next/server";

import { dbConfigured, logPageView } from "@/lib/db";

export const dynamic = "force-dynamic";

// This deployment's site tag. The landing page uses the same code with
// SITE = "landing", writing to the same page_views table.
const SITE = "wc26";

// Lightweight first-party page-view logging. The client beacon posts path +
// referrer + an anonymous per-browser id; the country comes from Vercel's geo
// header server-side. No cookies, no third party. Fire-and-forget: any failure
// is swallowed so it never affects the visitor.
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return new NextResponse(null, { status: 204 });
  let body: any = {};
  try {
    // sendBeacon may send as text/plain; parse defensively.
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : null;

  try {
    await logPageView({
      site: SITE,
      path: str(body.path, 200),
      referrer: str(body.referrer, 300),
      visitor: str(body.visitor, 64),
      country: req.headers.get("x-vercel-ip-country"),
    });
  } catch {
    // ignore
  }
  return new NextResponse(null, { status: 204 });
}
