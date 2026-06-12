import { GroupTable } from "@/components/GroupTable";
import { StaleBanner } from "@/components/StaleBanner";
import { fetchGroupStandings } from "@/lib/espn";

// Group tables refresh every 5 minutes; standings only move at full time.
export const revalidate = 300;

export default async function GroupsPage() {
  const result = await fetchGroupStandings();
  const groups = result.data ?? [];
  return (
    <div>
      <StaleBanner stale={result.stale} lastUpdated={result.lastUpdated} />
      <h1 className="mb-3 text-lg font-bold text-zinc-100">Groups</h1>
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
          Standings unavailable right now.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <GroupTable key={g.group} group={g.group} rows={g.rows} />
          ))}
        </div>
      )}
    </div>
  );
}
