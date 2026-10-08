import React, { useMemo } from 'react';
import { DropdownMenuButton, Icon } from '@mongodb-js/compass-components';
import type { QueryConfig } from '../config/schema';
import { parseQueryParts } from '../config/queries';
import type { ParsedQueryParts } from '../config/queries';
import { useQueriesForNamespace } from '../hooks';

/**
 * "Queries" button for the Documents toolbar: the predefined queries of the
 * collection (feature-level with a matching namespace, plus collection-level
 * ones from the feature and the model file). Picking one applies it to the
 * query bar through `onApply`.
 */
export const HighlighterQueriesMenu: React.FunctionComponent<{
  namespace: string;
  onApply(query: ParsedQueryParts, entry: QueryConfig): void;
}> = ({ namespace, onApply }) => {
  const queries = useQueriesForNamespace(namespace);
  const actions = useMemo(
    () =>
      queries
        .map((q, i) => ({ q, i, parts: parseQueryParts(q) }))
        .filter(({ parts }) => Object.keys(parts).length > 0)
        .map(({ q, i, parts }) => ({
          action: `query-${i}`,
          label: q.title,
          // keep the parsed parts with the action so onAction needs no lookup
          parts,
          entry: q,
        })),
    [queries]
  );
  if (actions.length === 0) {
    return null;
  }
  return (
    <DropdownMenuButton<string>
      data-testid="highlighter-queries-menu"
      actions={actions}
      onAction={(action: string) => {
        const hit = actions.find((a) => a.action === action);
        if (hit) {
          onApply(hit.parts, hit.entry);
        }
      }}
      buttonText="Queries"
      buttonProps={{
        size: 'xsmall',
        leftGlyph: <Icon glyph="Bulb" />,
        title: 'Predefined queries from the highlighter files',
      }}
    />
  );
};
