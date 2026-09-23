/**
 * Scores how well a typed query matches a label, for the command palette.
 * Every query character must appear in the label in order (a subsequence);
 * runs of consecutive characters and matches at the start of a word score
 * higher, so "nch" finds "New chat" before "Launch". Returns null when the
 * query does not match at all, so callers can filter and sort in one pass.
 */
export function fuzzyScore(query: string, label: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const text = label.toLowerCase();
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const char of q) {
    if (char === " ") continue;
    const at = text.indexOf(char, from);
    if (at === -1) return null;
    const wordStart = at === 0 || text[at - 1] === " " || text[at - 1] === "-" || text[at - 1] === "/";
    score += 1 + (at === previous + 1 ? 3 : 0) + (wordStart ? 4 : 0);
    previous = at;
    from = at + 1;
  }
  // Prefer shorter labels among equal matches: the query explains more of them.
  return score - text.length * 0.01;
}
