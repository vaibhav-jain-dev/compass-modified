/**
 * Field paths in the YAML use `items[].sku` to mean "sku of every element of
 * items". Compass reports element paths without array indexes
 * (`getNestedKeyPathForElement` skips them), so both sides normalise to
 * `items.sku` before comparing.
 *
 * Patterns may also contain wildcards, because documents often use dynamic
 * keys (a map keyed by an id): `*` matches exactly one segment and `**`
 * matches any number of segments (including none).
 */
export function normalizeFieldPath(path: string): string {
  return path
    .replace(/\[\]/g, '')
    .split('.')
    .filter((segment) => segment.length > 0)
    .join('.');
}

export function isWildcardPath(pattern: string): boolean {
  return pattern.includes('*');
}

/** Match a concrete, normalized path against a normalized pattern. */
export function matchFieldPath(pattern: string, path: string): boolean {
  if (!isWildcardPath(pattern)) {
    return pattern === path;
  }
  const p = pattern.split('.');
  const s = path.split('.');
  const memo = new Map<string, boolean>();
  const go = (i: number, j: number): boolean => {
    const key = `${i}:${j}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (i === p.length) {
      result = j === s.length;
    } else if (p[i] === '**') {
      result = go(i + 1, j) || (j < s.length && go(i, j + 1));
    } else if (j >= s.length) {
      result = false;
    } else if (p[i] === '*' || p[i] === s[j]) {
      result = go(i + 1, j + 1);
    } else {
      result = false;
    }
    memo.set(key, result);
    return result;
  };
  return go(0, 0);
}

/**
 * Lookup table keyed by normalized pattern. Exact patterns are O(1); wildcard
 * patterns are scanned in declaration order. The first exact hit wins over
 * wildcard hits, which lets a specific entry refine a generic one.
 */
export class PathIndex<T> {
  private readonly exact = new Map<string, T[]>();
  private readonly wildcard: Array<{ pattern: string; values: T[] }> = [];

  add(pattern: string, value: T): void {
    const normalized = normalizeFieldPath(pattern);
    if (isWildcardPath(normalized)) {
      const entry = this.wildcard.find((w) => w.pattern === normalized);
      if (entry) {
        entry.values.push(value);
      } else {
        this.wildcard.push({ pattern: normalized, values: [value] });
      }
      return;
    }
    const values = this.exact.get(normalized) ?? [];
    values.push(value);
    this.exact.set(normalized, values);
  }

  get(path: string): T[] {
    const normalized = normalizeFieldPath(path);
    const exact = this.exact.get(normalized);
    if (exact) {
      return exact;
    }
    const matches: T[] = [];
    for (const { pattern, values } of this.wildcard) {
      if (matchFieldPath(pattern, normalized)) {
        matches.push(...values);
      }
    }
    return matches;
  }

  get size(): number {
    return this.exact.size + this.wildcard.length;
  }
}

export function namespaceToDatabase(namespace: string): string {
  const dot = namespace.indexOf('.');
  return dot === -1 ? namespace : namespace.slice(0, dot);
}
