import "server-only";

import { getAllSbsLinks } from "./db";
import type { Match } from "./types";

// Attach stored SBS links to match objects for the UI. One table read covers
// every card on a page.
export async function withSbsLinks(matches: Match[]): Promise<Match[]> {
  const rows = await getAllSbsLinks();
  if (rows.length === 0) return matches;
  const byId = new Map(rows.map((r) => [r.match_id, r] as const));
  return matches.map((m) => {
    const row = byId.get(m.id);
    if (!row) return m;
    return {
      ...m,
      sbs: {
        live: row.sbs_live_url ?? null,
        highlights: row.sbs_highlights_url ?? null,
        extended: row.sbs_extended_url ?? null,
        full: row.sbs_full_url ?? null,
      },
    };
  });
}
