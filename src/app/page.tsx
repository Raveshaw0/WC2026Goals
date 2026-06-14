import { PhotoBackground } from "@/components/PhotoBackground";
import { fetchAllMatches } from "@/lib/espn";
import { withSbsLinks } from "@/lib/sbs";

import { ScheduleClient } from "./ScheduleClient";

export const dynamic = "force-dynamic";

// Single landing page: full schedule with the stats panel up top, centered on
// today. Header tabs (Schedule / Australia / Favourites) drive the filter via
// the query string.
export default async function HomePage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const result = await fetchAllMatches();
  const filter =
    searchParams.filter === "australia" || searchParams.filter === "favourites"
      ? searchParams.filter
      : "all";
  return (
    <>
      <PhotoBackground />
      <ScheduleClient
        initialMatches={await withSbsLinks(result.data ?? [])}
        initialStale={result.stale}
        initialLastUpdated={result.lastUpdated}
        filter={filter}
      />
    </>
  );
}
