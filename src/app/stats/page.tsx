import { SpoilerCover } from "@/components/SpoilerCover";
import { fetchLeaders } from "@/lib/espn";

import { StatsTabs } from "./StatsTabs";

// Leaders move slowly; 15 minutes matches how fast anyone checks them.
export const revalidate = 900;

export default async function StatsPage() {
  const result = await fetchLeaders();
  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-zinc-100">
        Tournament stats
      </h1>
      {result.data ? (
        <SpoilerCover sectionKey="stats" label="Reveal stats" rounded="rounded-2xl">
          <StatsTabs leaders={result.data} />
        </SpoilerCover>
      ) : (
        <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
          Stats unavailable right now.
        </div>
      )}
    </div>
  );
}
