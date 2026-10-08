import React from 'react';
import { IconButton, Icon } from '@mongodb-js/compass-components';
import { useHighlighterDispatchSafe, useHighlighterState } from '../hooks';
import { setDecorationsVisible } from '../stores';

/**
 * Documents toolbar button: hide or show every highlighter mark in the
 * document views (colours, chips, banner, link icons) for the session, for
 * reading a document plainly. Nothing is written to the YAML.
 */
export const HighlighterDecorationsToggle: React.FunctionComponent = () => {
  const dispatch = useHighlighterDispatchSafe();
  const enabled = useHighlighterState((s) => s.status === 'ready');
  const visible = useHighlighterState((s) => s.decorationsVisible);
  if (!enabled) {
    return null;
  }
  return (
    <IconButton
      aria-label={visible ? 'Hide highlighter marks' : 'Show highlighter marks'}
      title={
        visible
          ? 'Highlighter marks are shown. Click to read documents plainly.'
          : 'Highlighter marks are hidden. Click to show colours, chips and links.'
      }
      active={visible}
      onClick={() => dispatch(setDecorationsVisible(!visible))}
      data-testid="highlighter-decorations-toggle"
    >
      <Icon glyph="Highlight" />
    </IconButton>
  );
};
