import React, { useCallback } from 'react';
import {
  Button,
  Checkbox,
  Overline,
  css,
  spacing,
  Description,
} from '@mongodb-js/compass-components';
import {
  useHighlighterState,
  useHighlighterTags,
  useHighlighterDispatchSafe,
} from '../hooks';
import { setTagFilter } from '../stores';

const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[100],
  marginTop: spacing[300],
  width: '100%',
});

const actionsStyles = css({
  display: 'flex',
  gap: spacing[100],
  marginBottom: spacing[100],
});

const listStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[50],
  maxHeight: 240,
  overflow: 'auto',
});

const chipStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `0 ${spacing[150]}px`,
  borderRadius: spacing[100],
  fontSize: '12px',
  lineHeight: '20px',
});

/** Is the sidebar tag filter narrowing the tree right now? */
export function useHighlighterTagFilterActive(): boolean {
  return useHighlighterState((s) => s.tagFilter.length > 0);
}

/**
 * Multi-select of highlighter tags for the sidebar filter popover: collections
 * (or any of their fields) carrying a selected tag stay, the rest hide.
 */
export const HighlighterTagFilter: React.FunctionComponent = () => {
  const dispatch = useHighlighterDispatchSafe();
  const tags = useHighlighterTags();
  const selected = useHighlighterState((s) => s.tagFilter);
  const enabled = useHighlighterState((s) => s.status !== 'disabled');

  const toggle = useCallback(
    (name: string, checked: boolean) => {
      const next = checked
        ? [...selected, name]
        : selected.filter((t) => t !== name);
      dispatch(setTagFilter(next));
    },
    [dispatch, selected]
  );

  if (!enabled || tags.length === 0) {
    return null;
  }

  return (
    <div className={containerStyles} data-testid="highlighter-tag-filter">
      <Overline>Highlighter tags</Overline>
      <Description>
        Show only collections tagged with any of the selected tags.
      </Description>
      <div className={actionsStyles}>
        <Button
          size="xsmall"
          onClick={() => dispatch(setTagFilter(tags.map((t) => t.name)))}
          disabled={selected.length === tags.length}
        >
          Select all
        </Button>
        <Button
          size="xsmall"
          onClick={() => dispatch(setTagFilter([]))}
          disabled={selected.length === 0}
        >
          Clear
        </Button>
      </div>
      <div className={listStyles}>
        {tags.map((tag) => (
          <Checkbox
            key={tag.name}
            data-testid={`highlighter-tag-filter-${tag.name}`}
            checked={selected.includes(tag.name)}
            onChange={(evt) => toggle(tag.name, evt.target.checked)}
            label={
              <span
                className={chipStyles}
                style={{ color: tag.color, backgroundColor: tag.background }}
                title={tag.description}
              >
                {tag.name}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
};
