import type HadronDocument from 'hadron-document';
import type { Element as HadronElement } from 'hadron-document';

/**
 * One searchable node of the loaded documents. `path` uses the same format as
 * the "Copy path & value" context menu action, e.g. `sections[0].groups[0].label`.
 */
export type FinderEntry = {
  docIndex: number;
  path: string;
  element: HadronElement;
  pathLower: string;
  // Only leaf values are searchable by value, containers match by path.
  valueLower: string | null;
};

export type FinderMatch = {
  entry: FinderEntry;
  kind: 'key' | 'value';
};

type FinderContainer = HadronDocument | HadronElement;

const appendPathSegment = (path: string, segment: string) =>
  path === '' || segment.startsWith('[')
    ? `${path}${segment}`
    : `${path}.${segment}`;

const childSegment = (container: FinderContainer, key: string | number) =>
  container.currentType === 'Array' ? `[${key}]` : String(key);

const collectEntries = (
  container: FinderContainer,
  docIndex: number,
  containerPath: string,
  entries: FinderEntry[]
) => {
  for (const element of Array.from(container.elements ?? [])) {
    const path = appendPathSegment(
      containerPath,
      childSegment(container, element.currentKey)
    );
    const isContainer = Boolean(element.elements);
    entries.push({
      docIndex,
      path,
      element,
      pathLower: path.toLowerCase(),
      valueLower: isContainer ? null : element.toShellSyntax().toLowerCase(),
    });
    if (isContainer) {
      collectEntries(element, docIndex, path, entries);
    }
  }
};

export const buildFinderEntries = (docs: HadronDocument[]): FinderEntry[] => {
  const entries: FinderEntry[] = [];
  docs.forEach((doc, docIndex) => collectEntries(doc, docIndex, '', entries));
  return entries;
};

/**
 * Matches the query against field paths first, then leaf values. Matches are
 * returned in document order so that "next" moves through the documents.
 */
export const searchFinderEntries = (
  entries: FinderEntry[],
  query: string
): FinderMatch[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const matches: FinderMatch[] = [];
  for (const entry of entries) {
    if (entry.pathLower.includes(needle)) {
      matches.push({ entry, kind: 'key' });
    } else if (entry.valueLower?.includes(needle)) {
      matches.push({ entry, kind: 'value' });
    }
  }
  return matches;
};

/**
 * Completions for the query, built from the paths of the loaded documents of
 * the current collection. Paths that start with the query are listed before
 * paths that only contain it.
 */
export const suggestFinderPaths = (
  entries: FinderEntry[],
  query: string,
  limit = 10
): string[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const seen = new Set<string>();
  const startsWith: string[] = [];
  const contains: string[] = [];
  for (const { path, pathLower } of entries) {
    if (seen.has(path) || pathLower === needle) {
      continue;
    }
    seen.add(path);
    if (pathLower.startsWith(needle)) {
      startsWith.push(path);
    } else if (pathLower.includes(needle)) {
      contains.push(path);
    }
  }
  return [...startsWith, ...contains].slice(0, limit);
};
