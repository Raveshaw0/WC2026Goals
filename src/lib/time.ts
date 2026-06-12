// All user-facing times are Australia/Melbourne via Intl. No UTC offset maths:
// the IANA zone handles AEST/AEDT transitions for us.

const ZONE = "Australia/Melbourne";

export function melbourneTime(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function melbourneDateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function melbourneDateHeading(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

export function melbourneDateTimeShort(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function todayMelbourneKey(): string {
  return melbourneDateKey(new Date());
}
