import { validate } from 'mongodb-query-parser';
import type { QueryConfig } from './schema';

/**
 * Parses the `filter` of a query entry (shell syntax or extended JSON) into
 * the object Compass's query bar expects. Returns null when it cannot be
 * parsed, in which case the UI only offers copying the text.
 */
export function parseQueryFilter(
  query: Pick<QueryConfig, 'filter'>
): Record<string, unknown> | null {
  if (!query.filter) {
    return null;
  }
  const parsed = validate('filter', query.filter);
  return parsed && typeof parsed === 'object'
    ? (parsed as Record<string, unknown>)
    : null;
}

export function isRunnableQuery(query: QueryConfig): boolean {
  return Boolean(query.namespace) && parseQueryFilter(query) !== null;
}

export type ParsedQueryParts = {
  filter?: Record<string, unknown>;
  project?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  skip?: number;
  limit?: number;
};

/**
 * Parses every part of a query entry for the query bar. Parts that do not
 * parse are left out rather than failing the whole query.
 */
export function parseQueryParts(query: QueryConfig): ParsedQueryParts {
  const parts: ParsedQueryParts = {};
  const filter = parseQueryFilter(query);
  if (filter) {
    parts.filter = filter;
  }
  for (const key of ['project', 'sort'] as const) {
    const text = query[key];
    if (!text) continue;
    const parsed = validate(key, text);
    if (parsed && typeof parsed === 'object') {
      parts[key] = parsed as Record<string, unknown>;
    }
  }
  for (const key of ['skip', 'limit'] as const) {
    const raw = (query as Record<string, unknown>)[key];
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (raw !== undefined && Number.isFinite(num)) {
      parts[key] = num;
    }
  }
  return parts;
}
