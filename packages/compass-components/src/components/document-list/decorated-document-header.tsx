import React from 'react';
import { css } from '@leafygreen-ui/emotion';
import { spacing } from '@leafygreen-ui/tokens';
import { Icon } from '../leafygreen';
import { useCollectionDecoration } from './field-decorations-context';

const headerStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  padding: `${spacing[100]}px ${spacing[300]}px`,
  borderBottom: '1px solid transparent',
  fontSize: '12px',
  lineHeight: '20px',
});

const titleStyles = css({
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[100],
});

const notesStyles = css({
  opacity: 0.8,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/**
 * Fork extra feature (Highlighter): a coloured strip at the top of a document
 * card naming the collection the way the user thinks about it. Renders
 * nothing when the host did not provide a collection decoration.
 */
export const DecoratedDocumentHeader: React.FunctionComponent = () => {
  const collection = useCollectionDecoration();
  if (!collection) {
    return null;
  }
  return (
    <div
      className={headerStyles}
      style={{
        color: collection.color,
        backgroundColor: collection.background,
        borderBottomColor: collection.color,
      }}
      data-testid="decorated-document-header"
    >
      <span className={titleStyles}>
        {collection.icon && <Icon glyph={collection.icon} size="small" />}
        {collection.title}
      </span>
      {collection.notes && (
        <span className={notesStyles} title={collection.notes}>
          {collection.notes}
        </span>
      )}
    </div>
  );
};
