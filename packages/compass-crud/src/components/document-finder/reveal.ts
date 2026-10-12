import type HadronDocument from 'hadron-document';
import type { Element as HadronElement } from 'hadron-document';

/**
 * Makes the element render: every ancestor is expanded and each parent shows
 * enough children ("Show more" is collapsed by default past 25 fields).
 */
export const revealElement = (element: HadronElement) => {
  let child: HadronElement = element;
  let parent: HadronElement | HadronDocument | null = element.parent;
  while (parent) {
    const index = Array.from(parent.elements ?? []).indexOf(child);
    if (index >= parent.maxVisibleElementsCount) {
      parent.setMaxVisibleElementsCount(index + 1);
    }
    if (parent.isRoot()) {
      return;
    }
    parent.expand();
    child = parent;
    parent = parent.parent;
  }
};
