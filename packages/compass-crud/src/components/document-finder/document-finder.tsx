import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Checkbox,
  Icon,
  IconButton,
  TextInput,
  css,
  cx,
  palette,
  spacing,
} from '@mongodb-js/compass-components';
import { suggestFinderPaths, type FinderEntry } from './search';

export const findActiveRowStyles = css({
  '& [data-find-active="true"]': {
    backgroundColor: palette.yellow.light3,
  },
});

const finderStyles = css({
  position: 'absolute',
  top: spacing[200],
  right: spacing[400],
  zIndex: 10,
  width: 460,
  maxWidth: 'calc(100% - 32px)',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[100],
  padding: spacing[200],
  borderRadius: spacing[200],
  border: `1px solid ${palette.gray.light2}`,
  backgroundColor: palette.white,
  boxShadow: `0 2px 8px ${palette.gray.light2}`,
});

const rowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
});

const inputWrapperStyles = css({
  position: 'relative',
  flexGrow: 1,
  minWidth: 0,
});

const countStyles = css({
  minWidth: 64,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  color: palette.gray.dark1,
  fontSize: 12,
});

const togglesStyles = css({
  display: 'flex',
  gap: spacing[300],
  fontSize: 12,
});

const suggestionsStyles = css({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 11,
  maxHeight: 240,
  overflowY: 'auto',
  margin: 0,
  marginTop: spacing[50],
  padding: spacing[50],
  listStyle: 'none',
  borderRadius: spacing[100],
  border: `1px solid ${palette.gray.light2}`,
  backgroundColor: palette.white,
  boxShadow: `0 2px 8px ${palette.gray.light2}`,
  fontFamily: 'monospace',
  fontSize: 12,
});

const suggestionStyles = css({
  padding: `${spacing[50]}px ${spacing[100]}px`,
  borderRadius: spacing[50],
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const suggestionActiveStyles = css({
  backgroundColor: palette.blue.light3,
});

const getCountLabel = (
  query: string,
  matchCount: number,
  activeIndex: number
): string => {
  if (matchCount > 0) {
    return `${activeIndex + 1} of ${matchCount}`;
  }
  return query.trim() ? 'No results' : '';
};

type DocumentFinderProps = {
  // Used for path suggestions, so they come from the current collection.
  entries: FinderEntry[];
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  activeIndex: number;
  onStep: (direction: 1 | -1) => void;
  onlyMatchingDocuments: boolean;
  onOnlyMatchingDocumentsChange: (value: boolean) => void;
  onlyMatchingFields: boolean;
  onOnlyMatchingFieldsChange: (value: boolean) => void;
  // Changes each time Ctrl+F is pressed while the finder is open, so that
  // pressing it again refocuses and selects the input.
  focusRequest: number;
  onClose: () => void;
};

export const DocumentFinder: React.FunctionComponent<DocumentFinderProps> = ({
  entries,
  query,
  onQueryChange,
  matchCount,
  activeIndex,
  onStep,
  onlyMatchingDocuments,
  onOnlyMatchingDocumentsChange,
  onlyMatchingFields,
  onOnlyMatchingFieldsChange,
  focusRequest,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

  const suggestions = useMemo(
    () => (isSuggestionsOpen ? suggestFinderPaths(entries, query) : []),
    [entries, query, isSuggestionsOpen]
  );

  // Runs on mount too, since the first Ctrl+F is the one that opens the bar.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequest]);

  const acceptSuggestion = (path: string) => {
    onQueryChange(path);
    setSuggestionIndex(-1);
    setIsSuggestionsOpen(false);
    inputRef.current?.focus();
  };

  const moveSuggestion = (direction: 1 | -1) => {
    setIsSuggestionsOpen(true);
    setSuggestionIndex((index) => {
      if (index < 0) {
        return direction === 1 ? 0 : suggestions.length - 1;
      }
      return (index + direction + suggestions.length) % suggestions.length;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (suggestions.length === 0) {
          return;
        }
        event.preventDefault();
        moveSuggestion(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      case 'Enter': {
        event.preventDefault();
        const highlighted =
          suggestionIndex >= 0 ? suggestions[suggestionIndex] : undefined;
        if (highlighted !== undefined) {
          acceptSuggestion(highlighted);
        } else {
          onStep(event.shiftKey ? -1 : 1);
        }
        return;
      }
      case 'Escape': {
        if (isSuggestionsOpen && suggestions.length > 0) {
          setIsSuggestionsOpen(false);
        } else {
          onClose();
        }
        return;
      }
    }
  };

  const hasMatches = matchCount > 0;

  return (
    <div className={finderStyles} role="search" data-testid="document-finder">
      <div className={rowStyles}>
        <div className={inputWrapperStyles}>
          <TextInput
            ref={inputRef}
            aria-label="Find in documents"
            placeholder="Find a field path or value"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setSuggestionIndex(-1);
              setIsSuggestionsOpen(true);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setIsSuggestionsOpen(false)}
            onFocus={() => setIsSuggestionsOpen(true)}
          />
          {isSuggestionsOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              className={suggestionsStyles}
              data-testid="document-finder-suggestions"
            >
              {suggestions.map((path, index) => (
                <li
                  key={path}
                  role="option"
                  aria-selected={index === suggestionIndex}
                  className={cx(
                    suggestionStyles,
                    index === suggestionIndex && suggestionActiveStyles
                  )}
                  onMouseDown={(event) => {
                    // Keeps focus in the input so the list does not close first.
                    event.preventDefault();
                    acceptSuggestion(path);
                  }}
                >
                  {path}
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className={countStyles} data-testid="document-finder-count">
          {getCountLabel(query, matchCount, activeIndex)}
        </span>
        <IconButton
          aria-label="Previous match"
          onClick={() => onStep(-1)}
          disabled={!hasMatches}
        >
          <Icon glyph="CaretUp" />
        </IconButton>
        <IconButton
          aria-label="Next match"
          onClick={() => onStep(1)}
          disabled={!hasMatches}
        >
          <Icon glyph="CaretDown" />
        </IconButton>
        <IconButton aria-label="Close find" onClick={onClose}>
          <Icon glyph="X" />
        </IconButton>
      </div>
      <div className={togglesStyles}>
        <Checkbox
          label="Only matching documents"
          checked={onlyMatchingDocuments}
          onChange={(event) =>
            onOnlyMatchingDocumentsChange(event.target.checked)
          }
        />
        <Checkbox
          label="Only matching fields"
          checked={onlyMatchingFields}
          onChange={(event) => onOnlyMatchingFieldsChange(event.target.checked)}
        />
      </div>
    </div>
  );
};
