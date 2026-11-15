export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'person';
}

/** Path segment for the flow document page; never handed out as a person slug. */
export const FLOW_DOCUMENT_SLUG = 'flow-doc';

export function buildSlugMap(entries: Array<{ id: string; name: string }>): Record<string, string> {
  const used = new Set<string>([FLOW_DOCUMENT_SLUG]);
  const map: Record<string, string> = {};
  for (const entry of entries) {
    const base = slugifyName(entry.name);
    let slug = base;
    if (used.has(slug)) {
      slug = `${base}-${entry.id.slice(0, 4).toLowerCase()}`;
    }
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${entry.id.slice(0, 4).toLowerCase()}-${n++}`;
    }
    used.add(slug);
    map[entry.id] = slug;
  }
  return map;
}
