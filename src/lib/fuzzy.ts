/** Case-insensitive subsequence score: null = no match, higher = better. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const c of q) {
    ti = t.indexOf(c, ti);
    if (ti < 0) return null;
    score += 1;
    if (ti === prev + 1) score += 5; // consecutive
    if (ti === 0 || "/-_. ".includes(t[ti - 1])) score += 8; // word start
    prev = ti++;
  }
  return score;
}
