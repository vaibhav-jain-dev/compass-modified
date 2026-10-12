import { useEffect, useMemo, useState, type RefObject } from 'react';
import type HadronDocument from 'hadron-document';
import type { VirtualListRef } from '@mongodb-js/compass-components';
import {
  buildFinderEntries,
  collectFinderKeepIds,
  searchFinderEntries,
} from './search';
import { revealElement } from './reveal';
import { useFindHighlight } from './highlight';

const MAX_FRAMES_TO_WAIT_FOR_ROW = 30;

/**
 * Scrolls the row of `uuid` into view once the virtual list has rendered it,
 * and marks it as the active match.
 */
const scrollToRenderedElement = (
  container: HTMLElement | null,
  uuid: string
) => {
  let framesLeft = MAX_FRAMES_TO_WAIT_FOR_ROW;
  const attempt = () => {
    const row = container?.querySelector<HTMLElement>(
      `[data-document-element="true"][data-id="${uuid}"]`
    );
    if (!row) {
      if (framesLeft-- > 0) {
        requestAnimationFrame(attempt);
      }
      return;
    }
    container
      ?.querySelector('[data-find-active]')
      ?.removeAttribute('data-find-active');
    row.setAttribute('data-find-active', 'true');
    row.scrollIntoView({ block: 'center' });
  };
  requestAnimationFrame(attempt);
};

type UseDocumentFinderOptions = {
  docs: HadronDocument[];
  listRef: VirtualListRef;
  containerRef: RefObject<HTMLDivElement>;
};

/**
 * State and behaviour of the Ctrl+F finder in the documents list: the query,
 * the matches, the two filters, and moving through the matches.
 */
export const useDocumentFinder = ({
  docs,
  listRef,
  containerRef,
}: UseDocumentFinderOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [onlyMatchingDocuments, setOnlyMatchingDocuments] = useState(false);
  const [onlyMatchingFields, setOnlyMatchingFields] = useState(false);

  // Only indexed while the finder is open, so the list costs nothing otherwise.
  const entries = useMemo(
    () => (isOpen ? buildFinderEntries(docs) : []),
    [docs, isOpen]
  );
  const term = query.trim();
  const matches = useMemo(
    () => searchFinderEntries(entries, term),
    [entries, term]
  );
  const activeMatch = matches.at(activeIndex);

  // Every match is expanded up front, so they can all be seen at once.
  useEffect(() => {
    for (const { entry } of matches) {
      revealElement(entry.element);
    }
  }, [matches]);

  const keyMatchIds = useMemo(
    () =>
      new Set(
        matches
          .filter((match) => match.kind === 'key')
          .map((match) => match.entry.element.uuid)
      ),
    [matches]
  );

  const visibleDocIndexes = useMemo(() => {
    if (!onlyMatchingDocuments || !term) {
      return null;
    }
    const matchingDocIndexes = new Set(
      matches.map((match) => match.entry.docIndex)
    );
    return docs.flatMap((_, docIndex) =>
      matchingDocIndexes.has(docIndex) ? [docIndex] : []
    );
  }, [docs, matches, onlyMatchingDocuments, term]);

  const visibleDocs = useMemo(
    () =>
      visibleDocIndexes
        ? visibleDocIndexes.map((docIndex) => docs[docIndex])
        : docs,
    [docs, visibleDocIndexes]
  );

  const activeDisplayIndex = activeMatch
    ? (visibleDocIndexes?.indexOf(activeMatch.entry.docIndex) ??
      activeMatch.entry.docIndex)
    : -1;

  const keepIds = useMemo(
    () => (term && onlyMatchingFields ? collectFinderKeepIds(matches) : null),
    [matches, onlyMatchingFields, term]
  );

  useEffect(() => {
    if (!activeMatch || activeDisplayIndex < 0) {
      return;
    }
    listRef.current?.scrollToItem(activeDisplayIndex, 'center');
    scrollToRenderedElement(
      containerRef.current,
      activeMatch.entry.element.uuid
    );
  }, [activeMatch, activeDisplayIndex, listRef, containerRef]);

  useFindHighlight(containerRef, term, keyMatchIds);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f';
      if (!isFindShortcut) {
        return;
      }
      // Only take over Ctrl+F while the list has focus, not while typing in
      // the query bar or another input.
      const hasFocusInList =
        containerRef.current?.contains(document.activeElement) ||
        document.activeElement === document.body;
      if (!hasFocusInList) {
        return;
      }
      event.preventDefault();
      setIsOpen(true);
      setFocusRequest((request) => request + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [containerRef]);

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setActiveIndex(0);
  };

  const stepMatch = (direction: 1 | -1) => {
    if (matches.length === 0) {
      return;
    }
    setActiveIndex(
      (index) => (index + direction + matches.length) % matches.length
    );
  };

  const close = () => setIsOpen(false);

  return {
    isOpen,
    focusRequest,
    query,
    changeQuery,
    matchCount: matches.length,
    activeIndex,
    stepMatch,
    close,
    entries,
    onlyMatchingDocuments,
    setOnlyMatchingDocuments,
    onlyMatchingFields,
    setOnlyMatchingFields,
    visibleDocs,
    keepIds,
  };
};
