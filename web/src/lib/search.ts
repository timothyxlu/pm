import type { Issue } from './api';

/** Rank issues against a query: every term must match; IDs and titles count most. */
export function searchIssues(issues: Issue[], q: string, max = 100): Issue[] {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const i of issues) {
    const id = i.identifier.toLowerCase();
    const title = i.title.toLowerCase();
    const hay = `${id} ${title} ${(i.description ?? '').toLowerCase()} ${i.labels.join(' ').toLowerCase()}`;
    if (!terms.every((term) => hay.includes(term))) continue;
    let score = 0;
    for (const term of terms) {
      if (id === term) score += 100;
      else if (id.startsWith(term)) score += 20;
      if (title.includes(term)) score += 10;
    }
    if (i.status === 'done' || i.status === 'canceled') score -= 5;
    scored.push({ i, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.i.updated_at.localeCompare(a.i.updated_at))
    .slice(0, max)
    .map((s) => s.i);
}
