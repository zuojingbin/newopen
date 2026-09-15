export interface Orderable {
  filename: string;
  createdAt: number;
}

/**
 * Natural sort so "2.jpg" < "10.jpg" and "第2页.jpg" < "第10页.jpg" (plain
 * lexical order would put "10" before "2"). Falls back to upload time when
 * two names carry no comparable number, which keeps WeChat's original
 * chat-history send order when filenames are opaque (e.g. wx_camera_xxx).
 */
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const aParts = a.match(re) ?? [];
  const bParts = b.match(re) ?? [];
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? "";
    const bp = bParts[i] ?? "";
    if (ap === bp) continue;
    const an = Number(ap);
    const bn = Number(bp);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
    return ap < bp ? -1 : 1;
  }
  return 0;
}

export function autoOrder<T extends Orderable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byName = naturalCompare(a.filename, b.filename);
    if (byName !== 0) return byName;
    return a.createdAt - b.createdAt;
  });
}
