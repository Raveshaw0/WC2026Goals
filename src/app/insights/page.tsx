import { notFound } from "next/navigation";

import { InsightsPanel } from "@/components/InsightsPanel";
import { computeInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

// Human dashboard. Gated by ?key=INSIGHTS_KEY; a wrong/absent key 404s so the
// path reveals nothing. Nothing links here.
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: { key?: string; days?: string };
}) {
  const key = process.env.INSIGHTS_KEY;
  if (!key || searchParams.key !== key) notFound();

  const days = Math.min(
    365,
    Math.max(1, Number(searchParams.days) || 30)
  );
  const data = await computeInsights("wc26", days);
  return <InsightsPanel data={data} title="WC26 Tracker visitors" />;
}
