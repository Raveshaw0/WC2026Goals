import { BracketTree } from "@/components/BracketTree";
import { StaleBanner } from "@/components/StaleBanner";
import { fetchAllMatches } from "@/lib/espn";

// The bracket is derived from the same scoreboard we poll everywhere else, so
// render dynamically and let the 60s scoreboard cache bound freshness; the
// client then live-polls in-progress knockout matches.
export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const result = await fetchAllMatches();
  return (
    <div>
      <StaleBanner stale={result.stale} lastUpdated={result.lastUpdated} />
      <h1 className="mb-1 text-lg font-bold text-zinc-100">Bracket</h1>
      <p className="mb-3 text-xs text-zinc-400">
        The road to the final. Scroll sideways to follow both halves.
      </p>
      <BracketTree initialMatches={result.data ?? []} />
    </div>
  );
}
