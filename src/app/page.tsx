import { fetchAllMatches } from "@/lib/espn";
import { withSbsLinks } from "@/lib/sbs";

import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await fetchAllMatches();
  return (
    <HomeClient
      initialMatches={await withSbsLinks(result.data ?? [])}
      initialStale={result.stale}
      initialLastUpdated={result.lastUpdated}
    />
  );
}
