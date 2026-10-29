import React, { useEffect, useMemo, useState } from 'react';
import { EJSON } from 'bson';
import type HadronDocument from 'hadron-document';
import {
  Body,
  DocumentList,
  Icon,
  IconButton,
  Option,
  Select,
  css,
  cx,
  palette,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import { COMPARE_LIMITS } from './limits';
import { findFoldRegions } from './json-folds';
import {
  sideBySideLineDiff,
  type DiffCell,
  type DiffCellKind,
} from './line-diff';
import { annotateRows, type AnnotatedRow, type LineField } from './json-paths';

type DocumentPair = {
  key: string;
  left?: HadronDocument;
  right?: HadronDocument;
};

type PairStatus = 'unchanged' | 'changed' | 'left-only' | 'right-only';

const COMPARE_TARGET_LABEL_ID = 'query-compare-target-label';

// Only the database is picked for now; the collection is the current one.
const compareNamespace = (database: string, ns: string) =>
  `${database}.${ns.slice(ns.indexOf('.') + 1)}`;

export type QueryCompareViewProps = {
  ns: string;
  docs: HadronDocument[];
  // The applied query. A comparison result is only shown for the query it ran.
  query: unknown;
  // True while the current collection's documents are being refreshed
  isFetching: boolean;
  listComparableDatabases: () => Promise<string[]>;
  fetchComparisonDocuments: (ns: string) => Promise<HadronDocument[]>;
  onClose: () => void;
  // Wraps the cells of the compared namespace in its highlighter decorations
  decorateNamespace: (
    namespace: string,
    children: React.ReactNode
  ) => React.ReactNode;
};

type ComparisonResult = {
  ns: string;
  query: unknown;
  docs: HadronDocument[];
};

// Documents are matched by _id. When the projection leaves _id out, they are
// matched by their position in the result instead.
function documentKey(doc: HadronDocument, position: number): string {
  const id = doc.getId();
  return id === undefined || id === null
    ? `position:${position}`
    : EJSON.stringify({ _id: id });
}

function pairDocuments(
  left: HadronDocument[],
  right: HadronDocument[]
): DocumentPair[] {
  const rightByKey = new Map(
    right.map((doc, position) => [documentKey(doc, position), doc])
  );
  const pairs: DocumentPair[] = [];
  const matchedKeys = new Set<string>();
  left.forEach((doc, position) => {
    const key = documentKey(doc, position);
    matchedKeys.add(key);
    pairs.push({ key, left: doc, right: rightByKey.get(key) });
  });
  right.forEach((doc, position) => {
    const key = documentKey(doc, position);
    if (!matchedKeys.has(key)) {
      pairs.push({ key, right: doc });
    }
  });
  return pairs;
}

function linesOf(doc: HadronDocument | undefined): string[] {
  return doc ? doc.toEJSON().split('\n') : [];
}

function statusOf(
  pair: DocumentPair,
  leftLines: string[],
  rightLines: string[]
): PairStatus {
  if (!pair.right) {
    return 'left-only';
  }
  if (!pair.left) {
    return 'right-only';
  }
  return leftLines.join('\n') === rightLines.join('\n')
    ? 'unchanged'
    : 'changed';
}

const statusLabel = (status: PairStatus, ns: string, compareNs: string) => {
  switch (status) {
    case 'unchanged':
      return 'unchanged';
    case 'changed':
      return 'changed';
    case 'left-only':
      return `only in ${ns}`;
    case 'right-only':
      return `only in ${compareNs}`;
  }
};

const viewStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
  padding: spacing[300],
});

const toolbarStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

// A fixed width keeps the picker the same size whichever database is chosen.
const pickerStyles = css({
  width: 260,
});

const columnTitlesStyles = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: spacing[200],
  fontWeight: 'bold',
});

const documentBlockStyles = css({
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${palette.gray.light2}`,
  borderRadius: spacing[100],
  overflow: 'hidden',
});

const documentHeaderStyles = css({
  display: 'flex',
  justifyContent: 'space-between',
  padding: `${spacing[100]}px ${spacing[200]}px`,
  backgroundColor: palette.gray.light3,
});

const gutterStyles = css({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
});

const rowStyles = css({
  display: 'grid',
  gridTemplateColumns: '24px 1fr 1fr',
  fontFamily: 'monospace',
  fontSize: 12,
  whiteSpace: 'pre',
  overflowX: 'auto',
});

const cellStyles = css({
  minHeight: 18,
  padding: `0 ${spacing[200]}px`,
  borderRight: `1px solid ${palette.gray.light2}`,
  '&:last-child': { borderRight: 'none' },
});

const removedCellStyles = css({ backgroundColor: palette.red.light3 });
const addedCellStyles = css({ backgroundColor: palette.green.light3 });
const emptyCellStyles = css({ backgroundColor: palette.gray.light3 });
const removedDarkCellStyles = css({ backgroundColor: palette.red.dark3 });
const addedDarkCellStyles = css({ backgroundColor: palette.green.dark3 });
const emptyDarkCellStyles = css({ backgroundColor: palette.gray.dark3 });

function cellKindStyles(kind: DiffCellKind, darkMode: boolean): string {
  switch (kind) {
    case 'removed':
      return darkMode ? removedDarkCellStyles : removedCellStyles;
    case 'added':
      return darkMode ? addedDarkCellStyles : addedCellStyles;
    case 'empty':
      return darkMode ? emptyDarkCellStyles : emptyCellStyles;
    case 'same':
      return '';
  }
}

const chipStyles = css({
  marginLeft: spacing[200],
  padding: `0 ${spacing[100]}px`,
  borderRadius: spacing[100],
  fontFamily: 'sans-serif',
  fontSize: 11,
  lineHeight: '16px',
});

// Highlighter decorations come from the document list's context, so the cell
// must sit under the provider of its namespace. Diff colours stay on the
// background; the field's own colours show as text, and as background only on
// unchanged lines.
const DiffCellView: React.FunctionComponent<{
  cell: DiffCell;
  field?: LineField;
}> = ({ cell, field }) => {
  const darkMode = Boolean(useDarkMode());
  const decoration = DocumentList.useFieldDecoration(
    field?.path ?? '',
    () => undefined,
    field?.key,
    field?.path
  );
  return (
    <div
      className={cx(cellStyles, cellKindStyles(cell.kind, darkMode))}
      title={decoration?.label}
      style={{
        color: decoration?.color,
        fontWeight: decoration?.bold ? 'bold' : undefined,
        textDecoration: decoration?.strikethrough ? 'line-through' : undefined,
        backgroundColor:
          cell.kind === 'same' ? decoration?.background : undefined,
      }}
    >
      {cell.text}
      {decoration?.chip && (
        <span
          className={chipStyles}
          style={{
            color: decoration.color,
            backgroundColor: decoration.background,
          }}
        >
          {decoration.chip}
        </span>
      )}
    </div>
  );
};

const DocumentDiffBlock: React.FunctionComponent<{
  title: string;
  status: string;
  rows: AnnotatedRow[];
  hiddenRows: number;
  decorateRight: (cell: React.ReactNode) => React.ReactNode;
}> = ({ title, status, rows, hiddenRows, decorateRight }) => {
  // Opening rows that are collapsed. Collapsing is per document, like the
  // JSON view, and works on either side of the diff.
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const folds = useMemo(() => findFoldRegions(rows), [rows]);

  const toggleFold = (index: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const hidden = new Set<number>();
  for (const [opener, end] of folds) {
    if (collapsed.has(opener)) {
      for (let i = opener + 1; i <= end; i++) {
        hidden.add(i);
      }
    }
  }

  return (
    <section
      className={documentBlockStyles}
      data-testid="query-compare-document"
    >
      <div className={documentHeaderStyles}>
        <Body weight="medium">{title}</Body>
        <Body>{status}</Body>
      </div>
      {rows.map((row, index) => {
        if (hidden.has(index)) {
          return null;
        }
        const end = folds.get(index);
        const isCollapsed = collapsed.has(index);
        return (
          <React.Fragment key={index}>
            <div className={rowStyles}>
              <div className={gutterStyles}>
                {end !== undefined && (
                  <IconButton
                    aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleFold(index)}
                  >
                    <Icon glyph={isCollapsed ? 'CaretRight' : 'CaretDown'} />
                  </IconButton>
                )}
              </div>
              <DiffCellView cell={row.left} field={row.leftField} />
              {decorateRight(
                <DiffCellView cell={row.right} field={row.rightField} />
              )}
            </div>
            {end !== undefined && isCollapsed && (
              <div className={rowStyles}>
                <div className={gutterStyles} />
                <Body>{`… ${end - index} lines collapsed`}</Body>
              </div>
            )}
          </React.Fragment>
        );
      })}
      {hiddenRows > 0 && (
        <div className={rowStyles}>
          <div className={gutterStyles} />
          <Body>{`${hiddenRows} more lines not shown`}</Body>
        </div>
      )}
    </section>
  );
};

/**
 * Fork extra feature: runs the current query against the same collection in
 * another database of the connection and shows the two results side by side,
 * with each document diffed like `git diff --side-by-side`.
 */
export const QueryCompareView: React.FunctionComponent<
  QueryCompareViewProps
> = ({
  ns,
  docs,
  query,
  isFetching,
  listComparableDatabases,
  fetchComparisonDocuments,
  onClose,
  decorateNamespace,
}) => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [database, setDatabase] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compareNs = database ? compareNamespace(database, ns) : null;

  useEffect(() => {
    let active = true;
    void listComparableDatabases()
      .then((list) => {
        if (active) {
          setDatabases(list);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [listComparableDatabases]);

  useEffect(() => {
    if (!compareNs) {
      return;
    }
    let active = true;
    fetchComparisonDocuments(compareNs)
      .then((docs) => {
        if (active) {
          setResult({ ns: compareNs, query, docs });
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [compareNs, fetchComparisonDocuments, query]);

  // The diff only uses a result that ran for the applied query, and only once
  // the current collection's documents for that query have arrived too.
  const compareDocs =
    result && result.ns === compareNs && result.query === query && !isFetching
      ? result.docs
      : null;

  // Caps keep a large page or a large document from filling memory or the DOM.
  const { blocks, notices } = useMemo(() => {
    if (!compareNs || !compareDocs) {
      return { blocks: [], notices: [] as string[] };
    }
    const { maxDocuments, maxRowsPerDocument, maxRowsTotal } = COMPARE_LIMITS;
    const notes: string[] = [];
    const shownDocs = docs.slice(0, maxDocuments);
    if (docs.length > shownDocs.length) {
      notes.push(
        `Showing the first ${shownDocs.length} of ${docs.length} documents.`
      );
    }
    const pairs = pairDocuments(shownDocs, compareDocs.slice(0, maxDocuments));
    const shownBlocks: {
      key: string;
      title: string;
      status: string;
      rows: AnnotatedRow[];
      hiddenRows: number;
    }[] = [];
    let rowsLeft = maxRowsTotal;
    for (const [index, pair] of pairs.entries()) {
      if (rowsLeft <= 0) {
        notes.push(
          `Stopped after ${shownBlocks.length} documents to keep the page responsive. Narrow the query to see the rest.`
        );
        break;
      }
      const leftLines = linesOf(pair.left);
      const rightLines = linesOf(pair.right);
      const allRows = annotateRows(
        sideBySideLineDiff(leftLines, rightLines),
        leftLines,
        rightLines
      );
      const rows = allRows.slice(0, Math.min(maxRowsPerDocument, rowsLeft));
      rowsLeft -= rows.length;
      shownBlocks.push({
        key: pair.key,
        title: `Document ${index + 1}`,
        status: statusLabel(
          statusOf(pair, leftLines, rightLines),
          ns,
          compareNs
        ),
        rows,
        hiddenRows: allRows.length - rows.length,
      });
    }
    return { blocks: shownBlocks, notices: notes };
  }, [compareNs, compareDocs, docs, ns]);

  const decorateRight = (cell: React.ReactNode) =>
    compareNs ? decorateNamespace(compareNs, cell) : cell;

  let content: React.ReactNode;
  if (error) {
    content = <Body data-testid="query-compare-error">{error}</Body>;
  } else if (!compareNs) {
    content = (
      <Body>
        Pick a database on this connection to run the same query against.
      </Body>
    );
  } else if (!compareDocs) {
    content = <Body>Running the query on {compareNs}…</Body>;
  } else {
    content = (
      <>
        {notices.map((notice) => (
          <Body key={notice} data-testid="query-compare-limit">
            {notice}
          </Body>
        ))}
        {blocks.map((block) => (
          <DocumentDiffBlock
            key={block.key}
            title={block.title}
            status={block.status}
            rows={block.rows}
            hiddenRows={block.hiddenRows}
            decorateRight={decorateRight}
          />
        ))}
      </>
    );
  }

  return (
    <div className={viewStyles} data-testid="query-compare-view">
      <div className={toolbarStyles}>
        <Body id={COMPARE_TARGET_LABEL_ID}>Compare with</Body>
        <Select
          aria-labelledby={COMPARE_TARGET_LABEL_ID}
          className={pickerStyles}
          size="xsmall"
          value={database ?? ''}
          onChange={(value: string) => {
            setResult(null);
            setError(null);
            setDatabase(value);
          }}
        >
          {databases.map((option) => (
            <Option key={option} value={option}>
              {option}
            </Option>
          ))}
        </Select>
        <IconButton aria-label="Close comparison" onClick={onClose}>
          <Icon glyph="X" />
        </IconButton>
      </div>
      {compareNs && (
        <div className={columnTitlesStyles}>
          <Body>{ns}</Body>
          <Body>{compareNs}</Body>
        </div>
      )}
      {content}
    </div>
  );
};
