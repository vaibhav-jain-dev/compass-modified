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
