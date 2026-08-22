export function normalizeTopicTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function topicSlug(title: string): string {
  return normalizeTopicTitle(title).replace(/\s+/g, '-');
}
export function tagOverlap(left: string[], right: string[]): number {
  const a = new Set(left.map(normalizeTopicTitle));
  const b = new Set(right.map(normalizeTopicTitle));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return [...a].filter((tag) => b.has(tag)).length / union.size;
}
