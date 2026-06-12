import { fetchAllMatches } from "@/lib/espn";
import { withSbsLinks } from "@/lib/sbs";

import { ScheduleClient } from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const result = await fetchAllMatches();
  return (
    <ScheduleClient
      initialMatches={await withSbsLinks(result.data ?? [])}
      initialStale={result.stale}
      initialLastUpdated={result.lastUpdated}
    />
  );
}
