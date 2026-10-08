import React, { useCallback } from 'react';
import {
  IconButton,
  Icon,
  Tooltip,
  Body,
} from '@mongodb-js/compass-components';
import { useHighlighterDispatch } from '../stores/context';
import { useActiveFeature, useHighlighterState } from '../hooks';
import { setListingOverride } from '../stores';

/**
 * Sidebar button next to the search box: show only the collections the
 * active feature lists, or everything. A session-only override; the YAML's
 * `display.listing` is not touched.
 */
export const HighlighterListingToggle: React.FunctionComponent = () => {
  const dispatch = useHighlighterDispatch();
  const feature = useActiveFeature();
  const listingOverride = useHighlighterState((s) => s.listingOverride);
  const onlyInterested =
    (listingOverride ?? feature?.display.listing) === 'only-interested';

  const toggle = useCallback(() => {
    dispatch(setListingOverride(onlyInterested ? 'all' : 'only-interested'));
  }, [dispatch, onlyInterested]);

  if (!feature) {
    return null;
  }

  return (
    <Tooltip
      trigger={({ children, ...props }: React.HTMLProps<HTMLButtonElement>) => (
        <IconButton
          {...(props as Record<string, unknown>)}
          aria-label={
            onlyInterested
              ? 'Show all collections'
              : 'Show only highlighted collections'
          }
          active={onlyInterested}
          onClick={toggle}
          data-testid="highlighter-listing-toggle"
        >
          <Icon glyph={onlyInterested ? 'VisibilityOff' : 'Visibility'} />
          {children}
        </IconButton>
      )}
    >
      <Body>
        {onlyInterested
          ? 'Showing only the collections of the active highlighter feature. Click to show all.'
          : 'Click to show only the collections of the active highlighter feature.'}
      </Body>
    </Tooltip>
  );
};
