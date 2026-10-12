import { createContext, useContext } from 'react';

/**
 * Restricts which fields of a document list are rendered during a find.
 * `keepIds` holds the uuids of the matching fields and their ancestors. `null`
 * means every field is shown.
 */
export type DocumentFindFilter = {
  keepIds: ReadonlySet<string> | null;
};

const DocumentFindFilterContext = createContext<DocumentFindFilter>({
  keepIds: null,
});

export const DocumentFindFilterProvider = DocumentFindFilterContext.Provider;

export const useDocumentFindFilter = (): DocumentFindFilter =>
  useContext(DocumentFindFilterContext);

/**
 * Keeps only the elements whose uuid is in the filter. Returns the list as is
 * when no filter is active.
 */
export const applyDocumentFindFilter = <T extends { uuid: string }>(
  elements: T[],
  filter: DocumentFindFilter
): T[] => {
  if (!filter.keepIds) {
    return elements;
  }
  return elements.filter((element) => filter.keepIds?.has(element.uuid));
};
