import type { Insights } from "@/lib/insights";

// Self-contained dark dashboard (inline styles so it renders identically on
// any site that drops it in). Server-rendered, no client JS.
const card: React.CSSProperties = {
  background: "#15191f",
  border: "1px solid #262b33",
  borderRadius: 16,
  padding: "16px 18px",
};

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: "#8b929c" }}>{label}</div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          color: accent ? "#34d399" : "#f4f4f5",
          lineHeight: 1.1,
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function List({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; count: number }>;
}) {
  return (
    <div style={card}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#a1a1aa",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>Nothing yet</div>
      ) : (
        rows.map((r) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "4px 0",
              fontSize: 14,
              color: "#d4d4d8",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.name}
            </span>
            <span style={{ fontWeight: 700, color: "#f4f4f5" }}>{r.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function InsightsPanel({
  data,
  title,
}: {
  data: Insights;
  title: string;
}) {
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.count));
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0e12",
        color: "#f4f4f5",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{title}</h1>
          <span style={{ fontSize: 13, color: "#8b929c" }}>
            last {data.windowDays} days
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <Stat label="Total views" value={data.totalViews} />
          <Stat
            label="Unique visitors"
            value={data.uniqueVisitors}
            accent
            hint="distinct devices"
          />
          <Stat
            label="Returning"
            value={data.returningVisitors}
            hint="came back another day"
          />
          <Stat
            label="From LinkedIn"
            value={data.fromLinkedIn}
            hint="views referred by LinkedIn"
          />
          <Stat
            label="Views (24h)"
            value={data.viewsLast24h}
            hint={`${data.uniquesLast24h} unique`}
          />
        </div>

        <div style={{ ...card, marginBottom: 12 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#a1a1aa",
              marginBottom: 10,
            }}
          >
            Views per day
          </div>
          {data.byDay.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>Nothing yet</div>
          ) : (
            data.byDay.map((d) => (
              <div
                key={d.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "2px 0",
                }}
              >
                <span
                  style={{
                    width: 84,
                    fontSize: 12,
                    color: "#8b929c",
                    flexShrink: 0,
                  }}
                >
                  {d.name}
                </span>
                <span
                  style={{
                    height: 12,
                    width: `${(d.count / maxDay) * 100}%`,
                    background: "#34d399",
                    borderRadius: 4,
                    minWidth: 2,
                  }}
                />
                <span style={{ fontSize: 13, color: "#d4d4d8" }}>{d.count}</span>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <List title="Top referrers" rows={data.topReferrers} />
          <List title="Top countries" rows={data.topCountries} />
          <List title="Top pages" rows={data.topPages} />
        </div>
      </div>
    </div>
  );
}
