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

export function titleMentionsTeam(title: string, teamName: string): boolean {
  const t = normalizeName(title);
  return aliasesFor(teamName).some((a) => t.includes(a));
}
