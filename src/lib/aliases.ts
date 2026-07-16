// Loose team-name matching for SBS title scanning. Each entry is a set of
// names that refer to the same team; a title "contains" a team if it contains
// any alias. Comparison is lowercase with diacritics stripped.

const ALIAS_GROUPS: string[][] = [
  ["south korea", "korea republic", "korea"],
  ["usa", "united states", "united states of america"],
  ["turkey", "turkiye"],
  ["czechia", "czech republic"],
  ["iran", "ir iran"],
  ["ivory coast", "cote d'ivoire", "cote divoire"],
  ["bosnia-herzegovina", "bosnia and herzegovina", "bosnia"],
  ["netherlands", "holland"],
  ["saudi arabia", "ksa"],
  ["new zealand", "nz"],
  ["cape verde", "cabo verde"],
  ["dr congo", "congo dr", "democratic republic of the congo"],
  ["curacao"],
];

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function aliasesFor(teamName: string): string[] {
  const norm = normalizeName(teamName);
  for (const group of ALIAS_GROUPS) {
    if (group.includes(norm)) return group;
  }
  return [norm];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The versus separator as SBS writes it in titles: "v", "vs", or "vs.".
const VERSUS = "\\s+(?:vs?\\.?)\\s+";

// A title matches a fixture only if it contains the two teams as an adjacent
// "A v B" pair (either order), not merely both names somewhere in the title.
// This is the crucial guard against multi-game roundup titles like
// "Quarter-finals: Norway v England, Argentina v Switzerland", which mention
// England and Argentina from two DIFFERENT games and would otherwise
// cross-match the England v Argentina fixture.
export function titleHasFixture(
  title: string,
  home: string,
  away: string
): boolean {
  const t = normalizeName(title);
  const a = aliasesFor(home).map(escapeRe).join("|");
  const b = aliasesFor(away).map(escapeRe).join("|");
  const l = "(?:^|[^a-z0-9])";
  const r = "(?:[^a-z0-9]|$)";
  const pair = (x: string, y: string) =>
    new RegExp(`${l}(?:${x})${VERSUS}(?:${y})${r}`);
  return pair(a, b).test(t) || pair(b, a).test(t);
}

// How many "A v B" separators the title carries. A dedicated single-match clip
// has one; a roundup show listing several games has more. Lets us rank a real
// match clip above a roundup that merely happens to contain the right pair.
export function versusPairs(title: string): number {
  return (normalizeName(title).match(/\s(?:vs?\.?)\s/g) ?? []).length;
}

// SBS's magazine-format recap ("FIFA Highlights Show | ...") versus the plain
// per-match highlights cut. Prefer the latter when both exist for a fixture.
export function isRecapShow(title: string): boolean {
  return /highlights show|round[ -]?up|magazine/.test(normalizeName(title));
}
