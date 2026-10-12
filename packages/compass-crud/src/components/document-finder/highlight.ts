import { useEffect, type RefObject } from 'react';
import { injectGlobal, palette } from '@mongodb-js/compass-components';

const HIGHLIGHT_NAME = 'document-finder-match';

// The CSS Custom Highlight API paints ranges of text without touching the DOM,
// so the React-rendered rows stay as they are.
injectGlobal(`
  ::highlight(${HIGHLIGHT_NAME}) {
    background-color: ${palette.yellow.light2};
    color: inherit;
  }
`);

const ROW_SELECTOR = '[data-document-element="true"]';
const KEY_SELECTOR = '[data-testid="hadron-document-element-key"]';

type HighlightApi = {
  highlights: Map<string, unknown>;
};

const getHighlightApi = (): HighlightApi | null => {
  const css = globalThis.CSS as unknown as HighlightApi | undefined;
  return css && 'highlights' in css ? css : null;
};

/**
 * Ranges of every case-insensitive occurrence of `term` in the text nodes below
 * `root`. Matches that span two text nodes are not found.
 */
export const findTextRanges = (root: Node, term: string): Range[] => {
  const needle = term.toLowerCase();
  if (!needle) {
    return [];
  }
  const document = root.ownerDocument ?? globalThis.document;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const ranges: Range[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').toLowerCase();
    for (
      let from = text.indexOf(needle);
      from !== -1;
      from = text.indexOf(needle, from + needle.length)
    ) {
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, from + needle.length);
      ranges.push(range);
    }
  }
  return ranges;
};

/**
 * Highlights the key of every row whose field matched by path, and every
 * occurrence of the term in the rendered rows.
 */
export const collectHighlightRanges = (
  root: HTMLElement,
  term: string,
  keyMatchIds: ReadonlySet<string>
): Range[] => {
  const ranges: Range[] = [];
  if (keyMatchIds.size > 0) {
    root.querySelectorAll<HTMLElement>(ROW_SELECTOR).forEach((row) => {
      const keyElement = row.querySelector<HTMLElement>(KEY_SELECTOR);
      if (keyElement && keyMatchIds.has(row.dataset.id ?? '')) {
        const range = (root.ownerDocument ?? document).createRange();
        range.selectNodeContents(keyElement);
        ranges.push(range);
      }
    });
  }
  return [...ranges, ...findTextRanges(root, term)];
};

/**
 * Keeps the highlight in sync with the rendered rows, which change while the
 * list scrolls or expands.
 */
export const useFindHighlight = (
  containerRef: RefObject<HTMLDivElement>,
  term: string,
  keyMatchIds: ReadonlySet<string>
) => {
  useEffect(() => {
    const container = containerRef.current;
    const highlightApi = getHighlightApi();
    if (!container || !highlightApi) {
      return;
    }
    const apply = () => {
      const ranges = collectHighlightRanges(container, term, keyMatchIds);
      if (ranges.length === 0) {
        CSS.highlights.delete(HIGHLIGHT_NAME);
        return;
      }
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    };
    let frame = 0;
    const scheduleApply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    apply();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      CSS.highlights.delete(HIGHLIGHT_NAME);
    };
  }, [containerRef, term, keyMatchIds]);
};
