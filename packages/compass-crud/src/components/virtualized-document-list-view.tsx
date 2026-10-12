import React, { useCallback, useMemo, useRef } from 'react';
import HadronDocument from 'hadron-document';
import {
  DocumentList,
  css,
  cx,
  spacing,
  VirtualList,
  type VirtualListItemRenderer,
  type VirtualListRef,
} from '@mongodb-js/compass-components';

import { type BSONObject } from '../stores/crud-store';
import type { DocumentProps } from './document';
import { DocumentListViewItem } from './document-list-view-item';
import {
  DocumentFinder,
  findActiveRowStyles,
} from './document-finder/document-finder';
import { useDocumentFinder } from './document-finder/use-document-finder';

const listContainerStyles = css({
  position: 'relative',
  height: '100%',
});

const spacingStyles = css({
  padding: spacing[400],
  paddingTop: 0,
  paddingRight: spacing[150],
});

const estimateDocumentInitialHeight = (doc: HadronDocument) => {
  const DEFAULT_VISIBLE_FIELDS = 25;
  const keylineCardBorder = spacing[25] + spacing[25];
  // top and bottom padding taken up by the document card
  const occupiedStaticSizePerItem = spacing[400] + spacing[400];
  // total size occupied by the "Show more fields" button whenever visible
  const showMoreButtonSize =
    DEFAULT_VISIBLE_FIELDS < doc.elements.size
      ? spacing[400] + spacing[200]
      : 0;
  // total size occupied by initially rendered fields
  const visibleFieldsSize =
    Math.min(DEFAULT_VISIBLE_FIELDS, doc.elements.size) *
    (spacing[400] + spacing[25]);

  return (
    keylineCardBorder +
    occupiedStaticSizePerItem +
    showMoreButtonSize +
    visibleFieldsSize
  );
};

type VirtualizedDocumentListViewProps = {
  docs: (HadronDocument | BSONObject)[];
  isEditable: boolean;
  initialScrollTop?: number;
  scrollTriggerRef?: React.Ref<HTMLDivElement>;
  scrollableContainerRef?: React.Ref<HTMLDivElement>;
  listRef?: VirtualListRef;
  __TEST_OVERSCAN_COUNT?: number;
  __TEST_LIST_HEIGHT?: number;
} & Pick<
  DocumentProps,
  | 'isTimeSeries'
  | 'copyToClipboard'
  | 'removeDocument'
  | 'replaceDocument'
  | 'updateDocument'
  | 'openInsertDocumentDialog'
>;

const VirtualizedDocumentListView: React.FC<
  VirtualizedDocumentListViewProps
> = ({
  docs: _docs,
  isEditable,
  isTimeSeries,
  initialScrollTop,
  scrollTriggerRef,
  scrollableContainerRef,
  copyToClipboard,
  removeDocument,
  replaceDocument,
  updateDocument,
  openInsertDocumentDialog,
  listRef,
  __TEST_OVERSCAN_COUNT,
  __TEST_LIST_HEIGHT,
}) => {
  const docs = useMemo(() => {
    return _docs.map((_doc) => {
      // COMPASS-5872 If doc is a plain js object rather than an instance of hadron-document Document
      // it may have an isRoot prop, which would cause the isRoot() to throw an error.
      if (typeof _doc?.isRoot === 'function' && _doc?.isRoot()) {
        return _doc as HadronDocument;
      }
      return new HadronDocument(_doc as any);
    });
  }, [_docs]);

  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackListRef = useRef<VirtualListRef['current']>(null);
  const resolvedListRef: VirtualListRef = listRef ?? fallbackListRef;
  const finder = useDocumentFinder({
    docs,
    listRef: resolvedListRef,
    containerRef,
  });
  const findFilter = useMemo(
    () => ({ keepIds: finder.keepIds }),
    [finder.keepIds]
  );

  const renderItem: VirtualListItemRenderer<HadronDocument> = useCallback(
    (
      doc: HadronDocument,
      docRef: React.Ref<HTMLDivElement>,
      docIndex: number
    ) => {
      return (
        <DocumentListViewItem
          doc={doc}
          docRef={docRef}
          docIndex={docIndex}
          isEditable={isEditable}
          isTimeSeries={isTimeSeries}
          scrollTriggerRef={scrollTriggerRef}
          copyToClipboard={copyToClipboard}
          removeDocument={removeDocument}
          replaceDocument={replaceDocument}
          updateDocument={updateDocument}
          openInsertDocumentDialog={openInsertDocumentDialog}
        />
      );
    },
    [
      isEditable,
      isTimeSeries,
      scrollTriggerRef,
      copyToClipboard,
      openInsertDocumentDialog,
      removeDocument,
      replaceDocument,
      updateDocument,
    ]
  );

  return (
    <div
      ref={containerRef}
      className={cx(listContainerStyles, findActiveRowStyles)}
    >
      <DocumentList.DocumentFindFilterProvider value={findFilter}>
        <VirtualList
          items={finder.visibleDocs}
          renderItem={renderItem}
          estimateItemInitialHeight={estimateDocumentInitialHeight}
          rowGap={spacing[200]}
          dataTestId="document-list"
          itemDataTestId="document-list-item"
          listOuterContainerClassName={spacingStyles}
          initialScrollTop={initialScrollTop}
          scrollableContainerRef={scrollableContainerRef}
          listRef={resolvedListRef}
          overScanCount={__TEST_OVERSCAN_COUNT}
          __TEST_LIST_HEIGHT={__TEST_LIST_HEIGHT}
        ></VirtualList>
      </DocumentList.DocumentFindFilterProvider>
      {finder.isOpen && (
        <DocumentFinder
          entries={finder.entries}
          query={finder.query}
          onQueryChange={finder.changeQuery}
          matchCount={finder.matchCount}
          activeIndex={finder.activeIndex}
          onStep={finder.stepMatch}
          onlyMatchingDocuments={finder.onlyMatchingDocuments}
          onOnlyMatchingDocumentsChange={finder.setOnlyMatchingDocuments}
          onlyMatchingFields={finder.onlyMatchingFields}
          onOnlyMatchingFieldsChange={finder.setOnlyMatchingFields}
          focusRequest={finder.focusRequest}
          onClose={finder.close}
        />
      )}
    </div>
  );
};

export default VirtualizedDocumentListView;
